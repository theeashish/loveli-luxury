# Disaster Recovery Runbook

For: the owner + any engineer on call · Written: 2026-05-30.
Production environment: Vercel + Supabase (project `thweaebhxsfxuxeosjty`,
"Loveli Luxury International", EU-West-1) + PayHero + Resend + Sentry +
Upstash Redis.

This runbook is **the truth about what we can recover and how**. Untested DR
is theatre — every step here is something you (or an engineer) can actually
execute. The §"Test the restore" section at the end is non-optional reading
before launch.

---

## Recovery objectives (the bar we set)

| Metric | Target | Notes |
|---|---|---|
| **RPO** (Recovery Point Objective) — data we can afford to lose | **24 hours** on Supabase Free; **2 minutes** on Supabase Pro+ (PITR) | Pro plan strongly recommended before real-money launch |
| **RTO** (Recovery Time Objective) — time from outage to restored service | **30 minutes** for application; **2–4 hours** for full-DB restore | App rollback via Vercel is instant; DB restore is the slow path |
| **Communication SLA** | Status page updated within **15 min** of confirmed outage | Better Stack + the status page we recommend below |

---

## Asset inventory (what could be lost, where it lives)

| Asset | Where | Backup posture | Restore mechanism |
|---|---|---|---|
| **Application code** | GitHub `theeashish/loveli-luxury`, `main` branch | Tracked in git, full history, 16 commits in 2026-05-30 hardening pass | `git clone` + `vercel deploy --prod` |
| **Application config** (env vars) | Vercel project settings | NOT versioned by Vercel — manual export needed (see §"Env export") | Re-set via `vercel env add` or dashboard |
| **DB schema** | Supabase Postgres + `supabase/migrations/*.sql` in git | Schema lives in git as 44 idempotent migrations that replay from blank | `npm run supabase:migrate` against a fresh project |
| **DB data** | Supabase Postgres (managed) | **Supabase Free**: nightly snapshot, ~24h granularity. **Supabase Pro**: PITR with ~2-minute granularity for up to 7 days. | Supabase dashboard → Database → Backups → Restore |
| **Storage objects** (catalog images) | Supabase Storage bucket `catalog` (public-read) | Versioned by Supabase per their object-versioning settings; not the same as DB backup | Bucket re-upload from `public/products/` if local; from Supabase backup if remote |
| **Payment ledger** (`commission_ledger`, `payouts`, `payment_attempts`, `audit_log`) | Supabase DB | Same as DB above. **Migration 040** UNIQUE prevents double-write on restore-then-replay race. | Same as DB above |
| **Secrets** (Supabase service-role key, PayHero auth token, Resend API key, Sentry auth token, Upstash token, Cron secret) | Vercel env vars (production scope) | NOT in any backup — rotate-on-loss policy | See §"Secrets recovery" |
| **PayHero callback registration** | PayHero dashboard | NOT in our control | Re-register the callback URL if it ever drops |

---

## Failure scenarios + step-by-step responses

### 1. Vercel deployment broken (code regression, bad build, runtime panic)

**Detection:** /api/health returns 5xx; Sentry alerts; uptime monitor pages
you.

**Recovery (≈ 2 minutes):**
1. `vercel rollback` from the CLI, **or** Vercel dashboard → Deployments →
   click the previous green deployment → "Promote to Production".
2. Confirm `/api/health?deep=1` returns 200 (`status: ok`).
3. Triage the broken build separately; the customer-facing site is back.

### 2. Supabase DB down (regional outage)

**Detection:** `/api/health?deep=1` returns 503 with `checks.db.ok = false`;
every page is throwing on first DB read.

**Recovery:**
1. Check Supabase status: https://status.supabase.com/. If it's their
   incident, **wait it out** — there is no faster path. Update your status
   page; tell customers M-Pesa orders may be delayed.
2. While you wait, **do not** mass-retry failed transactions. The webhook
   has its own dedup; the cron sweeper (`/api/cron/reconcile-pending`) will
   catch up automatically once the DB is back.
3. If the outage exceeds 4 hours, decide whether to cut to a restore (see
   §3) on a new project. Document the decision in the audit log.

### 3. Supabase data loss (someone DROP'd a table, ran a destructive migration, etc.)

**Detection:** specific tables/rows missing; audit log shows the destructive
action; customer reports inconsistent state.

**Recovery — Supabase PITR (Pro plan only):**
1. Supabase dashboard → Database → Backups → "Restore to point in time".
2. Pick a timestamp **just before** the destructive action. (The audit_log
   table is the best source for this — its `occurred_at` on the offending
   action.)
3. The restore creates a **new project**. You don't overwrite production
   in place — instead, swap.
4. After restore completes: dump the schema and target tables from the new
   project, apply to production (or swap the `NEXT_PUBLIC_SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` in Vercel to point at the restored project).
5. Run integration suite against the restored project to confirm money
   paths work:
   ```
   SUPABASE_URL=<restored> npm run test
   ```

**Recovery — Supabase Free (nightly snapshot only):**
1. Supabase Support ticket — they restore from snapshot manually. Expect
   **24 to 48 hours**. This is the single best argument for upgrading to
   Pro before real-money launch.
2. While waiting, freeze the broken project (read-only via RLS), tell
   customers M-Pesa is offline, do not attempt new orders.

### 4. PayHero callback registration lost

**Detection:** orders stay `pending` after STK push completes on the
customer's phone; M-Pesa receipt is sent to their SMS but our DB never
updates; `webhook_deliveries` stays empty under load.

**Recovery (≈ 5 minutes):**
1. PayHero dashboard → Channels → STK channel → Callback URL. Re-set to:
   ```
   https://loveli-luxury.vercel.app/api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>
   ```
2. Verify the token matches the value of `PAYHERO_WEBHOOK_TOKEN` in Vercel
   env: `GET` the webhook URL in a browser and confirm
   `{"tokenAccepted": true, …}` in the response.
3. Run `/api/cron/reconcile-pending` with the bearer secret to sweep up any
   orders that paid while the callback was down.

### 5. Secrets compromised (service-role key leaked in a log, env var misconfigured into client bundle, etc.)

**Detection:** unauthorized writes in `audit_log`; Sentry alerts on unknown
IPs; rotation policy on a periodic review.

**Recovery (≈ 15 minutes):**
1. Supabase dashboard → Settings → API → Reset `service_role` key.
2. Vercel dashboard → project → Settings → Environment Variables →
   `SUPABASE_SERVICE_ROLE_KEY` → Update with the new value → trigger a new
   deployment so the running functions pick it up.
3. If PayHero token: PayHero dashboard → API Keys → Regenerate → update
   `PAYHERO_AUTH_TOKEN` in Vercel + redeploy.
4. If Resend key: Resend dashboard → API Keys → revoke + regenerate.
5. Force every active user session to re-login: Supabase dashboard →
   Authentication → Users → "Sign out all users".
6. Audit the leak path. If it was a log, audit other logs for similar leaks.

### 6. GitHub access lost / repo compromised

**Detection:** unexpected commits on `main`; CI shows runs you didn't
trigger.

**Recovery:**
1. GitHub Settings → Security → Audit log: identify the compromised path
   (PAT, OAuth app, collaborator).
2. Revoke the compromise vector.
3. `git revert` any unauthorized commits, push to `main`, let CI verify
   green before deploying.
4. Rotate any secret that was referenced in a compromised commit.

---

## Env export — DO THIS BEFORE LAUNCH

Vercel does not back up env vars. The single command that creates a
versioned snapshot you keep offline:

```bash
vercel env pull .env.production.backup --environment=production
```

Run this once a week (or after any env change), encrypt the file
(`gpg -c .env.production.backup`), and store the `.gpg` somewhere off
Vercel/GitHub — a password manager (1Password, Bitwarden) is fine.

This is the smallest possible step that turns "DR for env vars" from
"hope nothing breaks" into "we have the values written down". Do it before
real-money launch.

---

## Secrets recovery

Secrets cannot be restored — they have to be re-issued at the source. The
list of secrets and their re-issue paths:

| Secret | Re-issue path |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → Service Role Key → "Reset" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon key (reset only if rotation cycle says so; rotating anon invalidates every client session) |
| `PAYHERO_AUTH_TOKEN` | PayHero dashboard → API Keys → Regenerate |
| `PAYHERO_WEBHOOK_TOKEN` | Generated by you (`openssl rand -hex 32`) — re-set in Vercel env + re-register in PayHero callback URL |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `REVALIDATE_SECRET`, `CRON_SECRET` | Generated by you (`openssl rand -hex 32`) — re-set in Vercel env |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash dashboard → Redis → Settings |
| `SENTRY_AUTH_TOKEN` | Sentry dashboard → Settings → Auth Tokens |

After any rotation: `vercel deploy --prod --yes` so the new function
deployment picks up the value.

---

## Test the restore — once a quarter, mandatory

**A backup you have never restored is not a backup.** Once a quarter,
run this drill:

1. Create a fresh Supabase project (Free tier is fine for the drill).
2. Apply every migration in `supabase/migrations/*.sql` to it via
   `npm run supabase:migrate` (or the Supabase CLI). Confirm zero errors
   — our migration set is verified to replay clean from blank as of
   2026-05-30.
3. Seed the new project with at least one product + variant + sponsor
   distributor + a pending signup order using the admin UI.
4. Run the integration suite against it:
   ```
   SUPABASE_PROJECT_REF=<drill> npm run test:coverage
   ```
   Expect 338/338 pass. If the harness fails, *that is the finding* —
   investigate before relying on the restore path in a real incident.
5. Document the drill: date, who ran it, what migrations were applied,
   what failed, what was fixed.

Drill log:

| Date | Operator | Outcome | Notes |
|---|---|---|---|
| _DRILL NOT YET PERFORMED_ | _Before launch_ | — | — |

---

## Cross-references

- `docs/uptime-monitor-setup.md` — the external uptime service that pings
  `/api/health` and alerts on failure (this is the "detection" side of
  every scenario above).
- `docs/go-live-mpesa.md` — PayHero / Daraja Go-Live runbook.
- `docs/transformation-masterplan-2026-05.md` — current shipped state.
- `src/app/api/health/route.ts` — the health probe this runbook references.
- `docs/PROJECT-BRIEF.md` — owner-facing snapshot of the system.
