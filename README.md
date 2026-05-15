# Loveli Luxury International

Ecommerce + MLM platform for Loveli Luxury International, a Kenya-first luxury perfume brand expanding globally.

**Stack:** Next.js 14 (App Router) · TypeScript strict · Supabase (Postgres, Auth, RLS) · Flutterwave (unified collect + payout) · Tailwind · Vitest

**Status:** **Phase 8 complete — ship-ready.** Phases 1–8 cover every feature of the published comp plan: invite-only signup with starter-package + registration fee, PV-based 7-level commissions, strict monthly maintenance, multi-month rank-up qualification with sequential promotion, monthly close + auto-drafted payouts, real Flutterwave refunds with commission claw-back, distributor portal (overview / downline / commissions / share with QR + OG / settings with SMS verification), admin tooling (orders / payouts / monthly close / clawback resolutions / distributor management / MSISDN verifications / analytics with cohort depth / catalog), Vercel-cron monthly close, customer profile self-service with email re-verification, and manual ledger adjustments that flow into payout drafts. 18 migrations, 179/179 tests passing, typecheck clean.

---

## Quick start

```bash
# 1. Install Node 20+
node --version

# 2. Install dependencies
npm install

# 3. Copy env template and fill in real values
cp .env.example .env.local
# Edit .env.local with values from Supabase + Flutterwave dashboards

# 4. Run dev server
npm run dev
# → http://localhost:3000

# 5. Run tests
npm test

# 6. Type check
npm run typecheck
```

---

## Project structure

```
loveli-luxury/
├── src/
│   ├── app/                      Next.js App Router pages and layouts
│   ├── components/               Reusable UI (shadcn/ui base)
│   ├── lib/
│   │   ├── env.ts                Zod-validated environment variables
│   │   ├── money.ts              BigInt minor units, basis points math
│   │   ├── flutterwave/          Payment + payout service
│   │   ├── mlm/
│   │   │   ├── commission-calculator.ts    Pure function, fully tested
│   │   │   ├── salary-calculator.ts        Two-condition qualifier
│   │   │   └── types.ts
│   │   └── supabase/
│   │       ├── client.ts         Browser client (RLS-enforced)
│   │       ├── server.ts         Server Component client
│   │       └── service.ts        Service-role client (bypasses RLS, server-only)
│   ├── middleware.ts             Auth refresh on every request
│   └── types/database.ts         Supabase-generated types
├── supabase/migrations/
│   └── 001_initial_schema.sql    22 tables, 47 RLS policies, full seed config
├── tests/
│   ├── unit/                     Vitest unit tests (TDD-first)
│   ├── integration/              DB integration tests (Phase 6)
│   └── fixtures/
│       └── comp-plan-examples.ts  Worked examples from PDF as canonical fixtures
├── scripts/
│   └── check-secrets.sh          Pre-commit + CI secret scanner
├── .github/workflows/ci.yml      Typecheck, lint, test, build, secret scan
├── next.config.js                CSP, HSTS, frame-deny, permissions policy
├── tsconfig.json                 strict + noUncheckedIndexedAccess
└── vitest.config.ts              80% coverage threshold on src/lib
```

---

## Security policy (NON-NEGOTIABLE)

This project follows strict industry-standard security from the start. Violations require full rebuild, not patches.

1. **No hardcoded credentials.** All secrets in `.env.local` (gitignored) or platform env vars
2. **`.env*` files are forbidden in git.** Pre-commit hook + CI block them
3. **RLS is mandatory** on every Supabase table. No exceptions
4. **Service-role key is server-only.** Never imported into client components
5. **Webhook signatures are verified** before any DB write
6. **CSP, HSTS, frame-deny** set in `next.config.js` and enforced by Cloudflare in production
7. **Branch protection on `main`.** No direct pushes. PRs require passing CI + review
8. **Audit log writes** on every config change. Immutable, no UPDATE or DELETE policy

If a credential leaks: rotate immediately, audit logs, do NOT patch in place. Treat the project as compromised and follow the incident runbook.

---

## Commission engine

Core logic in `src/lib/mlm/commission-calculator.ts`. Pure function, no DB calls. Tested against the PDF worked examples as canonical fixtures.

Run the tests to see assertions matching every numeric example from the comp plan:

```bash
npm test
```

Expected output: all tests pass on numbers including:

- 30ml package → Kes 800 / 360 / 200 / 120 / 80 / 40 / 40 across levels 1–7 (total Kes 1,640 = 41%)
- 50ml package → Kes 1,440 / 648 / 360 / 216 / 144 / 72 / 72 (total Kes 2,952 = 41%)
- Bronze month 1 example → Kes 8,400 gross, Kes 3,900 net after starter pack
- Gold active month example → Kes 67,000 gross
- Gold performance bonus → 2% × Kes 50,000 excess = Kes 1,000

---

## Money handling

- **Storage:** BigInt minor units (cents). 1 KES = 100 cents
- **Rates:** Integer basis points. 20% = 2000bp. 1.5% = 150bp
- **Display:** Convert at the edge using `formatKes()`. Never display raw bigints
- **Database columns:** `BIGINT NOT NULL` ending in `_minor`. CHECK constraints reject negatives where appropriate
- **Floats are forbidden** in any commission, salary, or payout calculation

---

## Database schema

See `supabase/migrations/001_initial_schema.sql`. 22 tables in 9 domains:

1. Auth and profiles (with `user_role` enum)
2. Catalog (products, variants, bundles, bundle items)
3. Addresses and orders (with `order_kind` enum separating retail / signup / restock)
4. MLM core (distributors + closure-table tree capped at depth 7)
5. Config tables (commission rates, ranks, salary tiers, starter packages) with versioning via `effective_from / effective_until`
6. Commission ledger, monthly salaries, rank-up bonuses, payouts
7. GSV snapshots for fast monthly close
8. Audit log (append-only via RLS, superadmin reads only)
9. RLS policies on every table

---

## Phase 1 — foundation (shipped)

- ✅ Next.js 14 + TypeScript strict scaffold
- ✅ Database migration with full schema, RLS, indexes, seed config
- ✅ Money helpers and commission calculator with full test coverage
- ✅ Salary calculator
- ✅ Flutterwave service for collect + M-Pesa B2C payout
- ✅ Supabase client/server/service factories with correct boundaries
- ✅ Security headers in `next.config.js` (CSP, HSTS, X-Frame-Options, etc.)
- ✅ Pre-commit secret scanner, CI with TruffleHog, strict `.gitignore`
- ✅ Auth refresh middleware

## Phase 2 — catalog & storefront (shipped)

- ✅ Product / variant / bundle / category CRUD admin pages
- ✅ Public catalog with SSG product pages and bundle pages
- ✅ Cart with Zustand persistence, cross-tab sync, BigInt-safe totals
- ✅ Inventory tracking on variants
- ✅ `/api/revalidate` route with bearer-token + path allow-list
- ✅ Cinematic homepage redesign (Lenis smooth scroll, Framer Motion)
- ✅ Catalog images migration (003 in this branch — product/bundle image
      tables + public-read storage bucket and policies)

## Phase 3 — checkout, orders, payouts (shipped)

- ✅ Migration `003_orders_rpc.sql`: `generate_order_number()` and atomic
      `mark_order_paid(order_id, provider_ref, paid_at)` RPC. The RPC takes
      a row lock, no-ops if not pending (idempotent against webhook retries),
      decrements variant inventory, expands bundles via `bundle_items`, flips
      to `paid`, and writes `audit_log`. Oversell rolls back via the
      `inventory_qty >= 0` CHECK.
- ✅ `createPaymentLink()` Flutterwave hosted-checkout helper.
- ✅ `POST /api/checkout/init` — auth → Zod-validate cart → server-side
      re-price + inventory pre-check → resolve / insert shipping address →
      sponsor cookie lookup → generate order number → insert order +
      order_items via service role → `createPaymentLink` → return link.
- ✅ `/checkout` page (login-gated; address picker with reuse + inline new
      address, profile-defaulted contact phone, summary).
- ✅ `/checkout/return` — UX fast-path: re-verifies the FW transaction,
      calls the same idempotent RPC, then renders the order's current state.
      Cart-clear client island fires only on a confirmed paid status.
- ✅ `POST /api/payments/webhook` — verifies `verif-hash`, cross-checks via
      `verifyTransaction`, sanity-checks amount + currency, calls
      `mark_order_paid`, revalidates `/shop` on first transition.
- ✅ Sponsor cookie middleware — `?ref=LL-XX-XXXX` becomes a 30-day
      first-touch httpOnly cookie; attached to `orders.sponsor_distributor_id`
      at checkout init.
- ✅ Customer surfaces — `/account/orders` (RLS-scoped list) and
      `/account/orders/[id]` (full detail with shipping address and
      bundle/variant labels resolved through the service client so
      deactivated catalog rows still render).
- ✅ Admin order surface — `/admin/orders` (q/status/kind filters with
      colour-coded status pills) and `/admin/orders/[id]` (state machine:
      `pending→cancelled`, `paid→fulfilled→shipped→delivered`,
      `paid|fulfilled|shipped→refunded`). Each transition is optimistically
      locked and writes an `audit_log` row.
- ✅ Payouts (gated by `ENABLE_PAYOUTS`):
  - `/admin/payouts` list, `/admin/payouts/new` distributor + period picker
    with preview of unpaid commissions / salary / rank-up bonuses.
  - "Create draft" claims source rows (sets their `payout_id`) and creates
    a `pending` payouts row. UNIQUE(distributor_id, year, month) enforces
    one payout per period.
  - `/admin/payouts/[id]` detail with "Initiate M-Pesa transfer" — flips
    `pending → processing` under an optimistic lock, calls the FW Transfer
    API, stores `flutterwave_transfer_id`. Rolls back to `pending` on API
    failure so the admin can retry.
  - `POST /api/payouts/webhook` — verifies signature, idempotent terminal
    guard, sets `processing → completed | failed` from FW transfer events.
  - `/account/payouts` — distributor's read-only list, RLS-scoped.

### What deliberately *did not* land in Phase 3

- **Commission writing.** Orders capture `sponsor_distributor_id` so Phase 4
  can backfill the ledger; `mark_order_paid` does not yet emit
  `commission_ledger` rows.
- **Auto monthly close.** Salaries, GSV snapshots, and payouts are still
  manually triggered. Auto close + auto payout drafts are Phase 4.
- **Real Flutterwave refund.** `refund` in the order state machine is a
  status flip + audit entry only. Inventory is not auto-restocked. A real
  FW refund call and stock return are Phase 4.
- **Distributor signup flow.** The schema and starter packages are seeded;
  `kind = 'distributor_signup'` orders, KYC capture, and tree wiring on
  paid signup are Phase 4.

## Phase 4 — commission engine, signup, monthly close, refunds, portal (shipped)

### Wave 1 — earnings flow + invite-only signup

- ✅ Migration `004_commission_ledger.sql`:
  `write_commission_ledger(order_id)` walks the closure tree from
  `orders.sponsor_distributor_id` (depths 0-6 → levels 1-7), looks up the
  active `config_commission_rates` row at `paid_at` per level, applies
  integer-truncated math (matches the Phase 1 JS calculator), inserts
  ledger rows. Idempotent on `source_order_id`. Service-role only.
- ✅ Migration `005_provision_distributor.sql`:
  `provision_distributor(order_id)` converts a paid `distributor_signup`
  order into a `distributors` row + closure-tree insertion + role grant.
  Refuses missing/inactive sponsor (invite-only enforced at the DB layer).
  Hydrates KYC fields from `orders.notes` JSON. Idempotent on user_id.
- ✅ `/distributors/signup` page + `POST /api/distributor-signup/init`:
  login-gated, redirects existing distributors to portal, prefills sponsor
  code from `ll_sponsor` cookie, captures starter-bundle choice + KYC
  (national_id, dob, payout MSISDN), creates a `distributor_signup`
  order, returns FW link. Sponsor code is **required** at the API layer
  (first invite-only gate); the RPC is the second.
- ✅ Webhook + return path now run, on first paid transition:
  `mark_order_paid → (signup ? provision_distributor) →
  write_commission_ledger`. Webhook returns 5xx on RPC error so FW
  retries; return page swallows errors and lets the webhook be the
  safety net.

### Wave 2 — monthly close + auto-drafted payouts

- ✅ Migration `006_monthly_close.sql` — three idempotent RPCs:
  - `compute_gsv_snapshot(distributor, year, month)` — denormalises
    personal_bottles_sold, personal_sales_minor, team_gsv_minor (closure-
    table fan-out), active_recruits_count. Status filter on the source
    orders means refunded/cancelled orders drop out on re-run.
  - `compute_monthly_salary(distributor, year, month)` — qualifier
    (`min_personal_bottles && min_team_gsv_minor`) → fixed salary +
    performance bonus on excess GSV. Won't overwrite a row already
    attached to a payout (history-locked).
  - `detect_rank_up(distributor, year, month)` — promotes to the highest
    qualifying rank, inserts `rank_up_bonuses` (UNIQUE per (dist, rank)
    → once-only across history). Audit-logged.
- ✅ `/admin/close` — period picker + two action buttons (run close,
  draft payouts) + per-period GSV/salary table. Result banners after
  each action. Cross-linked from `/admin/orders` and `/admin/payouts`.

### Wave 3 — refunds + distributor portal

- ✅ Migration `007_refund_inventory.sql`:
  `restore_order_inventory(order_id)` mirrors the variant + bundle-
  expanded decrement done by `mark_order_paid` but adds back. Allowed
  from `paid|fulfilled|shipped` only; `delivered` refunds remain a
  Phase 5 manager-override path requiring a physical-return workflow.
- ✅ Real FW refund: `refundTransaction(transactionId, amount?)` in the
  Flutterwave service. The admin order detail's "Refund" action now does
  FW call → inventory restore RPC → status flip → audit. On FW failure
  the order stays paid; on RPC failure the FW refund is logged as
  "issued but inventory restore failed — investigate" so an admin
  intervenes rather than retrying blindly.
- ✅ `/account/distributor` portal (gated by the layout):
  - **Overview** — current rank with emoji, MTD GSV / personal sales /
    active recruits / downline size, next-rank progress bars, latest
    8 commissions.
  - **Downline** — per-level counters (L1-L7) + table of all descendants
    with depth, name, sponsor code, rank, joined date, active status.
    Email + phone hidden (admin-only).
  - **Commissions** — paginated ledger view with per-row level/basis/
    rate/amount/status, plus total-earned and unpaid-total stats.
  - **Share** — sponsor code prominent, ready-made shop link
    (`?ref=CODE`) and recruit link (`/distributors/signup?ref=CODE`),
    one-click copy buttons.
  - Layout enforces the gate: signed-out → `/login`; signed-in non-
    distributors → `/distributors/signup`; inactive distributors render
    the portal with a banner.

### What deliberately *did not* land in Phase 4

- **Refund webhook event handling.** Phase 4 refunds are synchronous —
  the admin action is the source of truth, and Flutterwave's refund
  webhook event shape varies enough by account version that adding
  speculative handling now would create drift. Phase 5 picks this up.
- **Commission claw-back on refund.** Refunded orders' ledger rows stay
  payable today. MLM-law rules around chargebacks vary by jurisdiction
  and demand a deliberate policy decision; Phase 5 land.
- **Payout MSISDN verification.** `provision_distributor` stamps
  `payout_msisdn_verified_at` on signup; a real STK-push verification
  loop is Phase 5.
- **Commission compression.** Inactive distributors in the chain still
  earn at their level. "Compress" rules (skip inactives, pull next
  active up) are a Phase 5 policy choice.
- **Cron monthly close.** `/admin/close` is admin-triggered. Auto-running
  on the 1st of each month is a Phase 5 ops nicety.
- **QR / social cards on share page.** Phase 5 polish.

## Phase 5 — operational hardening (shipped)

### Wave 1 — refund integrity

- ✅ Migration `008_commission_clawback.sql`:
  `void_unpaid_commissions_for_order(order_id)` deletes unpaid
  commission_ledger rows generated by an order, and reports the count of
  rows already paid out (so the admin sees a manager-attention warning
  rather than an unhelpful silent failure). Phase 5 deliberately does
  NOT auto-reverse paid commissions — chargeback policy varies by
  jurisdiction and is a Phase 6 decision.
- ✅ Admin refund action now runs FW refund → inventory restore →
  `void_unpaid_commissions_for_order` → status flip → audit. The
  `audit_log` row carries the claw-back result in `after_data` so the
  ops trail is traceable.
- ✅ Webhook safety net at `POST /api/payments/webhook` recognises
  refund events (loose pattern match: `/refund/i` or
  `/transaction\.refunded/i`), runs the same trio idempotently against
  the synchronous admin path, and ack-skips orders already in
  `refunded`.

### Wave 2 — payout safety + compression

- ✅ Migration `009_commission_compression.sql`:
  - New `config_settings` (key/value/JSONB) table, RLS read-everywhere
    / write-superadmin, plus a `get_setting_bool(key, default)` helper.
  - Seeded `commission_compression_enabled = false` (opt-in by default).
  - `write_commission_ledger` rewritten as a single CTE that produces
    either the standard chain (`level = chain_depth + 1`) or a
    compressed chain (active-only ancestors, `ROW_NUMBER` over
    `chain_depth`). The closure-table cap of depth 7 is honoured —
    extending the visible chain is a Phase 6 schema change.
  - Audit log entry now records `compression_enabled` so the policy
    state at write-time is recoverable.
- ✅ Tightened the payout-init guard: `/admin/payouts/[id]` now
  requires `distributors.payout_msisdn_verified_at IS NOT NULL` AND
  the verified MSISDN to match the payout row's snapshot. A change of
  number invalidates an existing draft and forces a re-draft. The
  signup flow already stamps `verified_at = paid_at` (the successful
  starter-package charge serves as the initial verification); a real
  STK-push re-verify-on-change loop is Phase 6.

### Wave 3 — cron + ops

- ✅ Refactored close orchestration into `src/lib/close/orchestrate.ts`
  (`runCloseForPeriod`, `draftPayoutsForPeriod`, `lastFullUtcMonth`).
  The admin Server Actions and the new cron route now share one
  iteration loop, audit-log shape, and result type.
- ✅ `POST /api/cron/monthly-close` — bearer-secured (timing-safe
  compare against `CRON_SECRET`), accepts an optional body
  `{ year?, month?, draft? }` (defaults to last full UTC month +
  draft = true), returns the `CloseResult` and `DraftPayoutsResult`.
  Idempotent — re-invocation is safe.
- ✅ `CRON_SECRET` added to `serverSchema` in `lib/env.ts` (read
  lazily by the route so a missing value doesn't break boot).

### Wave 4 — portal polish + analytics

- ✅ Distributor downline page is now an **indented tree** built from
  `distributors.sponsor_id`, not a flat depth-only table. Per-level
  counters (L1-L7) remain at the top. Joined dates and inactive
  badges show on each row.
- ✅ `/admin/analytics` (gated by a fresh layout, cross-linked from
  every other admin section):
  - **Top earners (last 30 days)** — sum of `commission_ledger.amount_minor`
    per distributor, top 20, with a relative bar against the leader.
  - **New distributors (last 12 months)** — bar chart from
    `distributors.starter_paid_at` bucketed by month.
  - **Revenue (last 12 months)** — bar chart from `orders.total_minor`
    on `paid|fulfilled|shipped|delivered` orders.
  - All bars are CSS-rendered; no chart-library dependency yet (Phase
    6 can promote to a real chart lib if usage warrants).

### What deliberately *did not* land in Phase 5

- **Closure-table depth extension.** Compression with chain-extension
  (walk past depth 7 to find more active ancestors) would need the
  closure cap raised. Schema-side change deferred to Phase 6.
- **Real STK-push MSISDN verification.** Phase 5 enforces verification
  at the payout-init guard but the verification stamp itself is
  signup-time. SMS or STK-push re-verify-on-change is Phase 6.
- **Commission claw-back from already-paid payouts.** Reversing a row
  whose money has hit M-Pesa needs a deliberate accounting policy that
  wasn't in scope. Surfaced in audit_log for human resolution.
- **QR codes / OG share cards on `/account/distributor/share`.** Pure
  polish; deferred until the ops dashboard is bedded in.
- **Cron schedule itself.** The endpoint is ready; the scheduler
  config (Vercel cron `vercel.json`, pg_cron job, GitHub Action) is
  deployment-side. Document `POST /api/cron/monthly-close` with a
  bearer of `CRON_SECRET` to whatever runs it.

## Phase 6 — admin tooling & schema lift (shipped)

### Wave 1 — MSISDN change-flow

- ✅ Migration `010_msisdn_change.sql` adds
  `payout_msisdn_pending` + `payout_msisdn_pending_at` columns to
  `distributors` plus a partial index for the admin queue.
- ✅ `/account/distributor/settings` lets a distributor submit a new
  payout MSISDN. Submission lands the value in `pending`, clears
  `payout_msisdn_verified_at`, and audit-logs the request. Phase 5's
  payout-init guard refuses to fire to an unverified number.
- ✅ `/admin/distributors/verifications` lists pending MSISDN changes
  with current vs. proposed numbers. Approve/Reject buttons hit the
  same Server Action with different decisions; rejection leaves the
  old MSISDN unverified by design (a disowned number shouldn't keep
  receiving payouts). Channel-agnostic: actual SMS / STK-push
  verification is Phase 7+.

### Wave 2 — clawback resolutions

- ✅ Migration `011_clawback_resolutions.sql` adds a workflow table
  with `UNIQUE(order_id)` and CHECK constraints that enforce the two
  legal resolution shapes: `written_off` (no payout reference) and
  `deducted_from_payout` (must reference a payouts row).
- ✅ Both the admin refund action and the refund webhook safety net
  now insert a clawback_resolutions row when the void RPC reports
  `already_paid > 0`. UNIQUE(order_id) makes the insert idempotent
  across the admin/webhook race.
- ✅ `/admin/clawbacks` surfaces:
  - **Pending** section with inline forms for per-row decisions —
    optional notes, optional payout id, two submit buttons (Write off,
    Deducted) sharing the same action.
  - **Resolved** section with the last 50 decisions and the matching
    audit-log timestamps.
  - The action validates that a referenced payout exists, applies an
    optimistic lock against `resolution IS NULL`, and writes a
    `clawback.resolved` audit_log row.

### Wave 3 — closure-table depth lift

- ✅ Migration `012_closure_table_extension.sql` raises the
  `distributor_tree.depth` CHECK from 7 to 14 (drops the original
  inline constraint by name with a defensive fall-through that scans
  for any `depth%`-named CHECK).
- ✅ `add_distributor_to_tree` extended to insert up to depth 14, with
  `ON CONFLICT DO UPDATE SET depth = EXCLUDED.depth` so a re-run is
  idempotent.
- ✅ New `rebuild_distributor_tree_for(distributor_id)` helper —
  walks `sponsor_id` chain and idempotently re-populates rows. The
  migration calls it in a `DO $$` block for every existing
  distributor so the new depths are immediately visible.
- ✅ `write_commission_ledger` rewritten so the compressed branch
  scans `depth BETWEEN 0 AND 13` (14 visible levels) and ROW_NUMBERs
  the active subset; plain branch still scans `0..6`. Compression can
  now skip up to 7 inactives in a row and still find 7 active
  ancestors to pay.

### What deliberately *did not* land in Phase 6

- **SMS / STK-push MSISDN verification.** Phase 6 makes the change-
  flow admin-mediated; channel automation is Phase 7+ (Africa's
  Talking or Twilio integration).
- **Automatic payout adjustment from a clawback resolution.** The
  `deducted_from_payout` decision tracks intent only — the operator
  still re-drafts or edits the target payout manually. Phase 7+ may
  automate via a "deduct ledger" model.
- **Admin distributor management surface.** Search / view detail /
  deactivate / manual ledger adjustment UIs are Phase 7. For now,
  direct DB edits via the Supabase dashboard are the escape hatch.
- **Share-page polish (QR codes, OG images).** Pure presentation;
  deferred until ops dashboard is bedded in.

## Phase 7 — next

- SMS / STK-push integration for MSISDN verification (Africa's
  Talking primary, Twilio fallback).
- Automatic payout net-total adjustment when a clawback resolution
  references the payout (atomic decrement + audit).
- Admin distributor management: search by code / email / phone, view
  detail with downline + earnings + status timeline, deactivate /
  reactivate, manual commission ledger adjustments with mandatory
  notes + audit.
- Share page polish: QR codes (inline SVG, no dep), OG image route
  for `?ref=` links, social copy templates.
- Customer profile self-service (`/account/profile`).
- Cohort analytics depth: retention, ARPU, GSV-vs-payout health
  ratio, sponsor-tree heatmap.

---

## Phase 7 — operational hardening (shipped)

Built across four waves. See [migration 015](supabase/migrations/015_qualifying_streak.sql) and onward for the SQL, and `src/app/(admin)/admin/*` for the UI surfaces.

- **Wave 3 — multi-month rank qualification** (`015_qualifying_streak.sql`): `is_distributor_qualified_for_rank`, `count_qualifying_streak`, and a rewritten `detect_rank_up` that promotes one rank at a time and only when the target rank's `qualifying_months` of consecutive qualifying months are met.
- **Wave 3b — admin distributor management**: `/admin/distributors` searchable list (name / email / phone / sponsor code, active / inactive filter); `/admin/distributors/[id]` detail with deactivate/reactivate (mandatory reason, audit-logged).
- **Wave 4 — SMS MSISDN verification** (`016_msisdn_verifications.sql`): hashed 6-digit code, 15-min TTL, 5-attempt cap. `src/lib/sms/send.ts` ships against Africa's Talking when configured, falls back to `audit_log` relay otherwise. `/account/distributor/settings/verify` is the self-service entry point; the admin verifications page remains a fallback.
- **Wave 5 — auto payout adjustment from clawbacks** (`017_apply_clawback_deduction.sql`): the resolve-as-deducted action now atomically debits the referenced payout's `net_total_minor` (floors at zero, refuses if payout is `completed`).
- **Wave 6 — share-page polish**: server-rendered QR codes via `qrcode` package; `/r/[code]` short-link route with a branded dynamic `opengraph-image.tsx` (Vercel OG).
- **Wave 7 — `/account/profile` self-service**: full name, phone, preferences, marketing consent. Audit-logged.
- **Wave 8 — cohort analytics depth**: `/admin/analytics/cohorts` adds retention grid (color-coded), lifetime ARPU per cohort, and a monthly GSV-vs-commission-paid ratio (alerts if it strays outside the 30–45% band the comp plan implies).
- **Wave 9 — manual ledger adjustments** (`018_manual_ledger_adjustments.sql`): signed credits/debits on a dedicated table with reason + actor + period. Payout draft (`previewDraft` + both create-payout paths) folds unpaid adjustments into the commissions total and stamps `payout_id` on claim.

## Phase 8 — finalisation (shipped)

- **Vercel cron wiring**: `vercel.json` schedules `GET /api/cron/monthly-close` at `0 3 1 * *` (3am UTC on the 1st of every month). The route accepts both `GET` (Vercel sends GET with auto-injected `Authorization: Bearer $CRON_SECRET`) and `POST` (ad-hoc with optional period body). Shared auth + run-period helpers.
- **Customer email change**: `/account/profile` now has a "Change email" form that calls `supabase.auth.updateUser({ email })`. Supabase sends a confirmation link to the new address; the old one stays active until clicked. Audit-logged as `profile.email_change_requested`.

---

## Production runbook

### 1. Environment variables

Required (`.env.local` or platform env):

```
NEXT_PUBLIC_APP_URL                  https://… (canonical site URL)
NEXT_PUBLIC_APP_NAME                 Loveli Luxury International
NEXT_PUBLIC_SUPABASE_URL             https://thweaebhxsfxuxeosjty.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY        (Supabase anon key)
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY   (Flutterwave public key)
SUPABASE_SERVICE_ROLE_KEY            (server-only)
FLUTTERWAVE_SECRET_KEY               (server-only)
FLUTTERWAVE_ENCRYPTION_KEY           (server-only)
FLUTTERWAVE_WEBHOOK_SECRET_HASH      (server-only; must match FW dashboard)
REVALIDATE_SECRET                    32+ chars, also salts MSISDN code hashes
CRON_SECRET                          32+ chars, Vercel cron Bearer
```

Optional (gated features):

```
ENABLE_PAYOUTS                       'true' to enable real M-Pesa B2C
ENABLE_DISTRIBUTOR_SIGNUP            'true' to enable /distributors/signup
AFRICAS_TALKING_USERNAME             SMS provider (KE)
AFRICAS_TALKING_API_KEY
AFRICAS_TALKING_SENDER_ID
RESEND_API_KEY                       (transactional email; not yet wired)
RESEND_FROM_EMAIL
SENTRY_DSN                           (error tracking; not yet wired)
```

### 2. Migrations to apply, in order

Run each as a single paste in the Supabase SQL editor. All are idempotent.

1. `001_initial_schema.sql` — base 22 tables + RLS + seed config
2. `002_catalog_images.sql` — product/bundle image tables + Storage bucket
3. `003_orders_rpc.sql` — `generate_order_number`, `mark_order_paid`
4. `004_commission_ledger.sql` — `write_commission_ledger`
5. `005_provision_distributor.sql` — `provision_distributor`
6. `006_monthly_close.sql` — GSV / salary / rank-up RPCs
7. `007_refund_inventory.sql` — `restore_order_inventory`
8. `008_commission_clawback.sql` — `void_unpaid_commissions_for_order`
9. `009_commission_compression.sql` — `config_settings` + compressed branch
10. `010_msisdn_change.sql` — `payout_msisdn_pending` columns
11. `011_clawback_resolutions.sql` — clawback workflow table
12. `012_closure_table_extension.sql` — depth cap 7 → 14 + backfill
13. `014_comp_plan_v2_pv.sql` *(supersedes 013; folds in 013's schema lifts via `IF NOT EXISTS`)*
14. `015_qualifying_streak.sql` — multi-month streak helpers
15. `016_msisdn_verifications.sql` — SMS one-time-code table
16. `017_apply_clawback_deduction.sql` — `clawback_resolutions.applied_at` + RPC
17. `018_manual_ledger_adjustments.sql` — ops-driven signed adjustments

Plus, after migration 014, run once to link the starter-package fee to a bundle:

```sql
INSERT INTO config_starter_packages (package_code, bundle_id, joining_fee_minor)
SELECT 'A', id, 50000 FROM bundles
 WHERE is_starter_package = TRUE AND is_active = TRUE
 ORDER BY retail_price_minor ASC
 LIMIT 1
ON CONFLICT DO NOTHING;
```

### 3. Provider configuration

- **Flutterwave dashboard**:
  - Charge webhook: `${NEXT_PUBLIC_APP_URL}/api/payments/webhook`
  - Transfer webhook (for payouts): `${NEXT_PUBLIC_APP_URL}/api/payouts/webhook`
  - Secret hash on both: matches `FLUTTERWAVE_WEBHOOK_SECRET_HASH` env var
- **Africa's Talking** (optional, KE SMS): create app, populate the three `AFRICAS_TALKING_*` env vars
- **Supabase auth**:
  - Email templates: customise the "Change Email Address" template so the confirmation link points to a route in this app (default: `${NEXT_PUBLIC_APP_URL}/auth/callback`)
  - Site URL: set to `NEXT_PUBLIC_APP_URL`

### 4. Vercel deploy notes

- The repo ships a `vercel.json` with the monthly-close cron at `0 3 1 * *`. Vercel adds `Authorization: Bearer $CRON_SECRET` automatically.
- Set `CRON_SECRET` in Vercel project env (≥32 chars).
- Mark all `process.env.*_SECRET_*` / `*_API_KEY` / `*_SERVICE_ROLE_KEY` as Encrypted.
- `runtime = 'nodejs'` is declared in every route that needs the service-role client (cron, payments webhook, payouts webhook, etc.).

### 5. Day-of-launch checklist

- [ ] All 18 migrations applied (verify with `SELECT key FROM information_schema.tables WHERE table_name IN ('manual_ledger_adjustments', 'msisdn_verifications', 'clawback_resolutions')` — should return 3).
- [ ] `config_starter_packages` has at least one row linking a starter bundle to a non-zero joining fee.
- [ ] At least one variant per size (30ml = 550 PV / 50ml = 950 PV) seeded via migration 014.
- [ ] Founding distributor exists (seeded admin + admin manually creates their own distributor row with `sponsor_id = NULL` — the only legal NULL sponsor in the system).
- [ ] Test signup with `?ref=<founding sponsor code>` end-to-end; verify all of: payment, distributor row, tree, role grant, commission_ledger fan-out, audit log entries.
- [ ] Test retail checkout with `?ref=<distributor sponsor code>`; verify commissions land on the correct upline.
- [ ] Test refund on a paid order; verify inventory restored, unpaid commissions voided, paid commissions surface on `/admin/clawbacks`.
- [ ] Run monthly close manually for the current month; verify GSV snapshots populate.
- [ ] First-of-month: confirm Vercel cron fires and produces a `close` + `draft` response.
- [ ] `npm test` green; `npx tsc --noEmit` clean.

### 6. Known operational gaps

- **Commission compression** is implemented (migration 009) but `config_settings.commission_compression_enabled` defaults to `FALSE`. Flip via superadmin SQL when you want it on.
- **Email change confirmation page**: Supabase auth handles the redirect. If you customise the email template to land somewhere other than the default auth callback, ensure that route exists in this app.
- **Manual MSISDN admin override**: if a distributor submits a number and the SMS isn't delivered, the code is in `audit_log` (when Africa's Talking is unconfigured) and the admin can manually approve via `/admin/distributors/verifications` regardless.
- **Refund webhook event shape**: Phase 5 wired a defensive handler at `/api/payments/webhook` matching `event` names containing `refund`. Flutterwave's exact payload varies by account version — verify your first real refund's event name and tighten the regex if needed.

---

## Owner

Built by **Abala (NexDocs / Mbogiwood Productions)** for Loveli Luxury International.
