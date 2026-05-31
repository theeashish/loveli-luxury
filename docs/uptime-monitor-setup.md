# Uptime monitor — setup walkthrough

For: the owner · Written: 2026-05-30.

The platform now ships a `/api/health` endpoint (added 2026-05-30, see
`src/app/api/health/route.ts`). This file walks through wiring up an
**external** uptime monitor that pings it — because internal monitoring
is theatre. If the app is down, an internal monitor can't tell you.

## Why external

Vercel has its own basic monitoring, but it only tells you about Vercel-side
failures. It doesn't tell you about:

- DNS misconfigured at the registrar
- Vercel-to-Supabase network path broken
- An edge config you set yesterday turning the production deploy into a 500
  loop
- Your real customer's actual experience on Kenyan 4G

A monitor that lives outside Vercel + outside Supabase + ideally outside the
same cloud region as either of them is the only thing that tells you the
truth.

## What we built to support this

`GET /api/health` — two modes:

- **`/api/health`** — liveness only. Returns `200 {ok:true, mode:"liveness"}`
  if the function is reachable. Does **not** touch the DB or PayHero. Cheap
  enough to hit every minute.
- **`/api/health?deep=1`** — liveness + dependency depth-check. Probes the
  DB (real SELECT), validates server env, presence-checks PayHero env,
  presence-checks Upstash env. Returns 200 if all critical checks pass,
  503 otherwise. Use this every 5 minutes so it catches "app up but DB
  gone" without hammering anyone.

Response is `Cache-Control: no-store` — monitors always get a fresh answer.
The endpoint deliberately returns nothing sensitive (no env values, no row
counts, no secret lengths).

## Recommended services (in order of preference)

| Service | Why I'm recommending it | Free tier | Best for |
|---|---|---|---|
| **[Better Stack](https://betterstack.com/) (formerly Better Uptime)** | Multi-region pings (US, EU, AP), incident response on the dashboard, public status page included, integrates with Sentry/Slack/email/SMS/phone-call alerts. The status page is bundled — you don't have to buy a separate one. | 10 monitors, 3-min checks, unlimited team members | **Money systems where you want status.loveliluxuryscents.com to exist** |
| **[Checkly](https://www.checklyhq.com/)** | Synthetic monitoring + API checks. Lets you write Playwright-style E2E checks that run from multiple regions. | 10k API check runs/month, 1500 browser check runs/month | When you want the monitor to run the actual checkout flow, not just hit /api/health |
| **[UptimeRobot](https://uptimerobot.com/)** | Cheapest, simplest. 5-minute granularity on the free tier. | 50 monitors, 5-min checks | Solo founder, low-touch, "I just want to know if the site goes down" |
| **[Pingdom](https://www.pingdom.com/)** | Industry-standard, expensive at scale, great alerting | None (paid only) | Enterprise teams — overkill here |

**My recommendation for Loveli right now**: Better Stack. The free tier
covers what you need, the bundled status page handles the
*communication* side of an incident (your customers seeing
"we're aware, we're working on it" instead of a wall of M-Pesa errors), and
it integrates with Sentry which is already live.

## 10-minute setup (Better Stack)

### 1. Create the account

Browser → https://betterstack.com/users/sign-up. The free tier is fine to
start; you can upgrade later.

### 2. Create the high-frequency monitor

Better Stack dashboard → **Uptime** → **Create monitor** → **HTTP(S)**.

- **Name**: `Loveli — liveness`
- **URL**: `https://loveli-luxury.vercel.app/api/health`
- **Check frequency**: 1 minute (free tier allows 3-min; pick 3 then)
- **Regions**: pick at least **EU-Frankfurt** (closest to Vercel EU) and
  **Africa-Cape Town** if available, else **EU-London** + **US-East**
- **Expected status code**: 200
- **Expected response body contains** (advanced): `"ok":true`
- **Save**

### 3. Create the deep-check monitor

Same dashboard → **Create monitor** → **HTTP(S)**.

- **Name**: `Loveli — dependency health`
- **URL**: `https://loveli-luxury.vercel.app/api/health?deep=1`
- **Check frequency**: 5 minutes
- **Regions**: same as above
- **Expected status code**: 200
- **Expected response body contains**: `"status":"ok"`
- **Save**

The second monitor will alert you when the app is up but the DB is gone,
PayHero auth token rotates and breaks, env validation starts failing, etc.
— the kind of degradation that's invisible to a pure liveness check.

### 4. Wire up alerting

Better Stack → **Notifications** → set up **at least two channels**:

- **Email** (default — already there)
- **SMS** to your number (the free tier covers this for the owner)

For a money system you genuinely want SMS or a phone-call escalation. Don't
trust Slack/email alone — they get muted, batched, and ignored.

Optional but recommended:
- **Sentry integration** — Better Stack ↔ Sentry → incidents in Better
  Stack open Sentry issues, so the engineer triaging knows both "monitor
  fired" and "what error fired".
- **Slack/Discord** — for the team to see in a shared channel.

### 5. Create the public status page

Better Stack → **Status pages** → **Create**.

- **Name**: `Loveli Luxury Scents — status`
- **Subdomain**: pick something — `loveli.betteruptime.com` is fine for now,
  swap to `status.loveliluxuryscents.com` later (CNAME record at your DNS
  registrar; Better Stack walks you through it).
- **Components**: add at least:
  - "Storefront" → linked to the liveness monitor
  - "M-Pesa payments" → linked to the deep monitor
  - "Partner dashboard" → linked to the liveness monitor
- **Branding**: paste the Loveli logo from the brand kit; pick the cream/gold
  palette from `globals.css` (`--background: #F5F3EF`, `--primary` deepened
  gold).

The status page is what customers see when M-Pesa is down for two hours
and they wonder if their order went through. Without it, every other
incident becomes a flood of WhatsApp messages to concierge@.

### 6. Verify the chain works end-to-end (5 minutes)

This is the step that distinguishes "monitoring exists" from "monitoring
actually works":

1. Trigger an incident on purpose. The cleanest way: temporarily edit a
   placeholder env var on Vercel to break the `getServerEnv()` validation,
   so `/api/health?deep=1` starts returning 503. (Vercel: project →
   Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` →
   change to "x" → save → redeploy.)
2. Wait 5 minutes. Confirm Better Stack alerts you (email + SMS) and the
   status page goes red on the relevant component.
3. Reverse the env change. Redeploy. Confirm everything recovers within
   10 minutes and Better Stack auto-resolves the incident.
4. Document the drill in `docs/disaster-recovery-runbook.md` under the
   "Test the restore" log.

If steps 2 or 3 didn't fire as expected, **that's the finding**. Iterate
on the alert config until the chain is reliable. A monitor that doesn't
alert is worse than no monitor — it's a false sense of security.

## After setup: ongoing operations

- **Once a month**: log into Better Stack and check the incident log. If
  there were intermittent failures you didn't notice, those are real bugs
  to triage.
- **Once a quarter**: re-run the "verify the chain works" drill in step 6.
  Alert configs decay: someone deletes a phone number, an SMS provider
  changes, Sentry integration tokens rotate.

## Cross-references

- `src/app/api/health/route.ts` — the endpoint the monitor pings.
- `docs/disaster-recovery-runbook.md` — what to do when the monitor fires.
- `docs/delivery-punchlist-2026-05.md` — the launch checklist (uptime
  monitor was open until this doc landed).
