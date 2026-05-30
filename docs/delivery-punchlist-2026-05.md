# Loveli Luxury — Delivery punch-list

Single source of truth for what stands between today and a real-money launch.
Checkboxes are live — tick as done. Owners: **🟦 Code (me)** · **🟨 Client/Owner
(Ruth / Ashish)** · **🟥 External (Safaricom / 3rd-party)**.

_Last updated: 2026-05-21._

## P0 — Hard blockers (cannot take a real shilling without these)
- [ ] 🟥 **Safaricom Daraja Go-Live** — apply + get approved; swap PayHero to the
      production channel + credentials. **Critical path / longest pole** — start now.
- [ ] 🟨 **Production catalog** — real fragrances: products, variants, prices, images,
      scent metadata (only ~2 test products exist today). Manage at `/admin/catalog`.
- [x] 🟦 **Order receipts (transactional email)** — shipped 2026-05-21: Resend-backed,
      non-fatal, fires on the paid webhook. **Activate** by setting `RESEND_API_KEY` +
      `RESEND_FROM_EMAIL` (a verified sender domain) in Vercel. No-op until then.
- [ ] 🟨 **B2C payout channel** — set `PAYHERO_CHANNEL_ID_B2C` + fund the wallet so
      partners can actually be paid.

## P1 — Before real customers (hardening + trust)
- [x] 🟦 **Rate limiting** — *shipped inert 2026-05-21*: fail-open limiter on
      `/api/checkout/init` (5/60s) + `/api/partner-signup/init` (3/60s). (Webhook
      deliberately excluded — it's token-gated; rate-limiting the payment callback is
      riskier than the abuse it would prevent.) **Activate:** create a free Upstash Redis,
      set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel.
- [x] 🟦 **Sentry** — *shipped inert 2026-05-21*: `withSentryConfig` + instrumentation;
      initialises only when a DSN is present. **Activate:** set `SENTRY_DSN` +
      `NEXT_PUBLIC_SENTRY_DSN` (and optionally `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`
      for source maps) in Vercel. ⚠ Adds ~60 kB to the shared client bundle even when inert —
      weigh against the perf budget.
- [x] 🟦 **Admin 2FA** — *shipped inert 2026-05-21*: enrolment / step-up page at
      `/account/security` + `adminMfaRedirect` gate on `/admin` (fail-open; never blocks
      un-enrolled admins). **Activate:** enable MFA (TOTP) in Supabase Auth settings →
      admins enrol at `/account/security` → set `ENFORCE_ADMIN_MFA=true` in Vercel.
- [ ] 🟦 **Performance** — hero already defer-mounts images + PDP has JSON-LD; re-run
      Lighthouse and close LCP < 2.5s / Performance ≥ 90 on Kenyan 4G.
- [ ] 🟨 **Trust content** — real reviews (CMS ready at `/admin/content/social-proof`),
      founder story, and customer **video** reviews (brand brief: non-negotiable for fragrance).
- [ ] 🟨 **Legal** — MLM comp-plan review (regulatory scrutiny flagged in the brief) +
      policy sign-off.

## P2 — Comp-plan cutover (your stated priority)
- [x] 🟦 v1 ledger complete (order 11 backfilled) + daily reconcile safeguard at
      `/admin/comp/commission-health`.
- [x] 🟦 v2 engine built + dry-run active (`COMPENSATION_ENGINE=both`).
- [ ] 🟦🟨 Review v1-vs-v2 deltas on the Commission-health page across real orders.
- [ ] 🟦 Flip `COMPENSATION_ENGINE=v2_tier` (cutover — only on explicit go).
- [ ] 🟦 Phase 2c (safe renames + fraud rules) → defer 2d (`distributors`→`partners`).

## P3 — Housekeeping
- [ ] 🟦 Regenerate `src/types/database.ts` (behind migrations 019–027) + drop the
      `as unknown as` casts that work around the stale types.
- [ ] 🟨🟦 Clear test data; seed production data.
- [ ] 🟦 Reconcile stale docs — `HANDOFF.md` / `TODO.md` / `README.md` pre-date the
      transformation (they say 246 tests / migration 020 unapplied; reality is 373 tests
      and migrations through 027 applied).

## Distance to delivery
- **Soft launch** (real money, starter catalog, receipts): ~**1–2 weeks** — *after* Daraja
  Go-Live clears.
- **Full launch** (P0 + P1 + comp-plan cutover): ~**4–6 weeks**.
- **Do this first:** start the Daraja Go-Live application — it has external lead time and
  gates everything real-money.
