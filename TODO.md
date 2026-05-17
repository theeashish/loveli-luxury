# TODO — Parked for after PayHero migration ships and is stable

Return to these in order. Do not start until PayHero has been live in production for ≥7 days with no payment-related incidents.

## Phase A residuals

### A5 — Wire Sentry (~30 min)

- `SENTRY_DSN` is already declared in `src/lib/env.ts` server schema
- `@sentry/nextjs` is in `package.json`
- Add `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (Sentry wizard does this)
- Wrap `next.config.js` export with `withSentryConfig`
- Set `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Vercel env
- Verify: throw a test error from a server action, confirm it appears in Sentry within 60s
- Add release tracking so deploys are tagged

### A6 — Rate limiting (~1 hour, needs Upstash account)

Targets:
- `POST /api/checkout/init` — 5 req / 60s per IP
- `POST /api/distributor-signup/init` — 3 req / 60s per IP
- `POST /api/payhero/checkout/init` — 5 req / 60s per IP (added by Phase B)
- `/login` POST (Supabase handles this server-side) — verify Supabase has rate-limiting on; if not, add wrapper
- `POST /api/payhero/webhook` — no rate limit, but add a 10 req / sec hard ceiling per IP

Steps:
1. Create Upstash Redis database (free tier OK)
2. Install `@upstash/redis` + `@upstash/ratelimit`
3. Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` to env
4. Create `src/lib/ratelimit.ts` with sliding-window limiter factory
5. Apply to each route. Return 429 with `Retry-After` header
6. Add bypass for admin user-agent (allow internal load tests)
7. Verify with `for i in {1..10}; do curl ...; done`

### A7 — 2FA via Supabase MFA on admin login (~3 hours)

- Enable MFA in Supabase project settings (TOTP)
- Add `src/app/(public)/account/security/page.tsx` — enrolment flow for admin users
- Modify admin login flow: after sign-in, if user has `admin`/`superadmin` role AND no MFA factor, force enrolment
- After enrolment, every admin sign-in requires TOTP challenge
- `src/lib/auth/roles.ts` — add `requireAdminMfa()` helper that throws if `aal2` is not present in JWT
- Apply to all `/admin/*` Server Actions
- Add backup-codes display in `/admin/security`
- Verify: sign in as admin → prompted for TOTP → enter code → admin works. Sign in without TOTP → blocked from `/admin/*`

## Phase B — completed (when this gets read)

PayHero migration. See git log for `migration-019-payment-provider` for the diff.

## Phase C (after A7)

Staging environment + CI/CD + Inngest queue. See architecture audit doc, §14.
