# Loveli Luxury — Phase 0 preflight audit

**Date:** 2026-05-18
**Production URL:** https://loveli-luxury.vercel.app
**Repo root:** `D:\loveli-luxury-phase1-scaffold\loveli-luxury`
**Status:** Read-only inventory. **No source files modified.** Awaiting sign-off before Phase 1 (Terminology & Positioning Refactor) begins.

---

## Why this document exists

The owner is preparing the §1–§13 Loveli Luxury transformation: pivoting the codebase from a perfume-store-with-MLM-page into a luxury commerce platform with a discreet "Luxury Commerce Partner Program". The transformation prompt mandates that Phase 0 ship before any source file is touched, so this doc enumerates exactly what's there today: stack, routes, components, compensation surface area, schema, vocabulary, design tokens, and performance baseline. Everything that follows can be verified by clicking the file paths.

Per the §2 non-negotiables: no code has been changed; no schema migrations have been authored as part of this preflight (migrations 021 and 022 referenced below were authored during the prior PayHero incident, *not* by this audit); the full schema column / policy / index detail is in the sibling file [docs/preflight-2026-05-schema-detail.md](preflight-2026-05-schema-detail.md) so the main doc stays scannable.

---

## 1. Stack inventory

| Layer | Choice | Version / notes |
|---|---|---|
| Framework | Next.js (App Router) | `14.2.35` |
| Language | TypeScript | `5.6.2`, strict mode (`tsconfig.json` enables `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`) |
| Runtime | Node | `>=20.0.0` (`engines` in `package.json`) |
| Package manager | npm | `package-lock.json` present; no yarn / pnpm lockfile |
| UI | React | `18.3.1` |
| Styling | Tailwind CSS | `3.4.13` + `tailwindcss-animate` `1.0.7` |
| Database | Supabase (Postgres 15+) | `@supabase/supabase-js 2.45`, `@supabase/ssr 0.5.2` |
| Server payments | PayHero (M-Pesa Lipa Na M-Pesa STK Push + B2C) | `@/lib/payhero/*` ; sandbox paybill **542542** in use (NOT a misconfiguration — Daraja Go-Live still pending; production paybill `174379` is the planned post-Go-Live target only) |
| Transactional email | Resend | `^4.0.0` (stubbed in `src/lib/email/affiliate-upgrade.ts`; no live receipt email implementation yet) |
| Forms + validation | `react-hook-form 7.53` + `@hookform/resolvers 3.9` + `zod 3.23` | Server input validation via Zod schemas in route handlers |
| Global client state | `zustand 5.0` | Cart store at `src/lib/cart/store.ts`, storage key `loveli-cart-v1` |
| Server-data query | `@tanstack/react-query 5.59` | |
| Icons | `lucide-react 0.456` | |
| Toast | `sonner 1.5` | |
| Theming | `next-themes 0.3` | Class-based dark mode |
| Composable variants | `class-variance-authority 0.7`, `clsx 2.1`, `tailwind-merge 2.5` | |
| Image processing | `sharp 0.34.5` | Used by `lib/catalog/image-pipeline.ts` for catalog uploads (server actions, 8 MB body cap) |
| QR | `qrcode 1.5.4` + `@types/qrcode 1.5.5` | Sponsor share / referral codes |
| Error tracking | `@sentry/nextjs 10.51` | Env: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (both optional in `src/lib/env.ts`) |
| Server-only marker | `server-only 0.0.1` | Compile-time guard on `src/lib/payments/dispatcher.ts` and similar |
| Test runner | `vitest 4.1.5` + `@vitest/coverage-v8` + `@testing-library/react 16` + `jsdom 25` | `tests/unit/**` — 16 files, **277 passing** as of this preflight |
| Lint | `eslint 8.57` + `eslint-config-next 14.2.35` + `eslint-plugin-security 3` | |
| Pre-commit | `husky 9.1` + `lint-staged 15.2` | Hook chain: `eslint --fix` + `scripts/check-secrets.sh` |
| Vercel project | `theeashishs-projects/loveli-luxury` | Project ID `prj_VAhKAnuwuAtwacTukeJKjwAGyShQ`, team ID `team_v9MXjregXTw2VYKpobGUYFjf`; **auto-deploy from git is disabled** — production ships via `vercel deploy --prod --yes` |
| Cron | Vercel scheduled | `vercel.json` registers `/api/cron/monthly-close` at `0 3 1 * *` (1st of each month, 03:00 UTC) |

**Env vars referenced** (read from `src/lib/env.ts` — names only, no secret values):

- Public: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GA4_MEASUREMENT_ID` (optional), `NEXT_PUBLIC_META_PIXEL_ID` (optional), `NEXT_PUBLIC_TIKTOK_PIXEL_ID` (optional).
- Server: `SUPABASE_SERVICE_ROLE_KEY`, `REVALIDATE_SECRET`, `CRON_SECRET` (optional), `SENTRY_DSN`/`SENTRY_AUTH_TOKEN` (optional), `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (optional), `AFRICAS_TALKING_USERNAME`/`_API_KEY`/`_SENDER_ID` (optional, SMS gateway), feature flags `ENABLE_DISTRIBUTOR_SIGNUP`/`ENABLE_PAYOUTS`/`ENABLE_MAINTENANCE_MODE`, PayHero block `PAYHERO_AUTH_TOKEN`/`PAYHERO_CHANNEL_ID_STK`/`PAYHERO_CHANNEL_ID_B2C`/`PAYHERO_WEBHOOK_TOKEN`.

**Tailwind config status:** confirmed clean — no undefined `loveli-*` utility class references in `src/**` (the only `loveli-*` literal anywhere is the cart store key, not a class). HSL-token-based design via CSS vars in `src/app/globals.css`. Full token list in §7.

---

## 2. Route map

### Public route group — `src/app/(public)/`

| Path | Purpose |
|---|---|
| `/` | Home (hero carousel, story strip, featured grid, scent finder, FAQ, distributor CTA). |
| `/shop` | Product listing (alias of `/bundles`-style index for the active catalog). |
| `/p/[slug]` | Product detail (variant picker, ATC, gallery). Static-generated for `/p/rose-noir` and `/p/loveli-signature`. |
| `/bundles` | Bundle listing. |
| `/bundles/[slug]` | Bundle detail with contents breakdown. SSG for `/bundles/founders-starter`. |
| `/boss-scents` | Compensation plan explainer (8 ranks, L1–L7 commission rates, PV per bottle, salary tiers). |
| `/cart` | Cart page (Zustand-backed). |
| `/checkout` | Retail checkout form (address selection, phone, summary, PayHero STK launch). |
| `/checkout/return` | Post-payment landing; renders `paid` / `failed` / `awaiting` from order state. |
| `/login` | Email/password sign in. Audience-aware subtitle copy. |
| `/signup` | Customer registration. Cross-links to distributor signup. |
| `/forgot-password` | Password-reset request. |
| `/reset-password` | Password-reset completion (token from URL). |
| `/post-login` | Server-component router by role: admin → `/admin/catalog`, distributor → `/account/distributor`, else → `/account/orders`. Honors explicit `?next=`. |
| `/account/profile` | Customer profile management. |
| `/account/orders` | Customer order history. |
| `/account/orders/[id]` | Customer order detail. |
| `/account/payouts` | Personal payout history (distributors only). |
| `/account/distributor` | Distributor dashboard (current rank, MTD GSV, downline size, latest commissions, next-rank targets). |
| `/account/distributor/commissions` | Personal commission ledger. |
| `/account/distributor/downline` | Indented tree of direct + descendant distributors. |
| `/account/distributor/share` | Sponsor code + invite link + copy button. |
| `/account/distributor/settings` | Payout MSISDN update. |
| `/account/distributor/settings/verify` | KYC verification flow. |
| `/distributors/signup` | Invite-only distributor onboarding. Sponsor code required (cookie-prefilled from `/r/[code]`); KYC capture; starter-bundle picker. |
| `/r/[code]` | Sponsor cookie capture + redirect. |
| `/r/[code]/opengraph-image-2v2hif` | OG image generation for invite links. |
| `/auth/callback` | Supabase OAuth redirect. |

### Admin route group — `src/app/(admin)/admin/`

| Path | Purpose |
|---|---|
| `/admin` | Admin dashboard overview. |
| `/admin/catalog` | Catalog overview. |
| `/admin/catalog/products` + `/new` + `/[id]` | Product CRUD. |
| `/admin/catalog/bundles` + `/new` + `/[id]` | Bundle CRUD. |
| `/admin/orders` | Order list (filters: status, kind, search). |
| `/admin/orders/[id]` | Order detail + state-transition controls (cancel/fulfill/ship/deliver/refund) + the new **Reconcile PayHero payment** button. |
| `/admin/payouts` + `/new` + `/[id]` | Payout listing, drafting, detail. |
| `/admin/distributors` + `/[id]` + `/verifications` | Distributor list, profile, KYC verification queue. |
| `/admin/close` | Monthly close orchestration (GSV snapshot → monthly salary → rank-up). |
| `/admin/clawbacks` | Clawback resolution queue (paid commissions on refunded orders). |
| `/admin/people/tree` | Full distributor tree viewer. |
| `/admin/analytics` + `/cohorts` | Cohort analytics (lifetime ARPU per signup month). |
| `/admin/comp/starter-packages` | Versioned editor for `config_starter_packages.joining_fee_minor`. |
| `/admin/diagnostics` | Env + DB + PayHero diagnostics widget. |
| `/admin/system/roles` | Superadmin role grant/revoke UI. |

### API routes — `src/app/api/`

| Path | Method | Purpose |
|---|---|---|
| `/api/checkout/init` | POST | Server-driven retail checkout init. Includes the new pending-order reuse + STK refire-throttle guards from PayHero idempotency work. |
| `/api/distributor-signup/init` | POST | Distributor onboarding init. Invite-only (sponsor required, no self-sponsor). Same idempotency guards as retail checkout. |
| `/api/payhero/webhook` | GET, POST | Inbound STK callback. GET returns a diagnostic-friendly 200 for URL validators; POST is the actual handler with token check + `webhook_deliveries` dedup + idempotent RPC chain. |
| `/api/payhero/payout-webhook` | POST | Outbound B2C callback. |
| `/api/payhero/status` | GET | Read-only polling endpoint scoped to caller's own order via RLS. |
| `/api/payhero/retry-stk` | POST | Refires STK push against an existing pending order owned by the caller. Used by `StkPushPanel` "Resend M-Pesa prompt". |
| `/api/payhero/reconcile` | POST | Admin-only force-reconciliation. Queries PayHero's transaction-status endpoint and runs the same `mark_order_paid → provision_distributor → write_commission_ledger` chain. |
| `/api/cron/monthly-close` | GET, POST | Vercel-cron entry to GSV snapshot + monthly salary + rank-up detection. |
| `/api/revalidate` | POST | Bearer-secret-gated ISR revalidation with strict path allowlist. |

---

## 3. Component inventory

Grouped by `src/components/<domain>/`.

### `header/` — site chrome
- `HeaderAuth.tsx` — auth-aware top-right controls.
- `AffiliateUpgradeLink.tsx` — header CTA for signed-in non-distributor non-admin users.
- `MobileMenu.tsx` — mobile nav drawer.

### `home/` — landing page sections
- `Hero.tsx`, `Story.tsx`, `FeaturedGrid.tsx`, `FindYourScent.tsx`, `FAQ.tsx`, `DistributorCTA.tsx`, `Marquee.tsx`.

### `catalog/` — product + bundle UI
- `ProductCard.tsx`, `ProductGallery.tsx`, `VariantPicker.tsx`, `AddToCartButton.tsx`.
- Admin variants: `AdminProductForm.tsx`, `AdminImageUploader.tsx`, `AdminVariantsEditor.tsx`, `AdminBundleForm.tsx`.
- Bundles: `BundleAddToCart.tsx`, `BundleContents.tsx`, `BundleHighlight.tsx`.

### `cart/`
- `CartDrawer.tsx`, `CartIndicator.tsx`, `CartLineItem.tsx`, `CartPageClient.tsx`.

### `checkout/`
- `CheckoutForm.tsx` — retail checkout form.
- `StkPushPanel.tsx` — STK polling + retry UI; owns the retry-stk POST.
- `ClearCartOnSuccess.tsx` — cart reset on `/checkout/return` paid state.

### `account/`
- `AccountStatusCard.tsx` — role + tier + metrics summary.
- `AffiliateUpgradeBanner.tsx` — cream-card cross-sell for retail buyers.

### `distributors/`
- `SignupForm.tsx` — distributor onboarding form.
- `CopyButton.tsx` — copy-to-clipboard.

### `admin/`
- `AdminSidebar.tsx` — canonical sidebar nav.
- `RolesTable.tsx` — admin role assignment.
- `FoundingCodeCard.tsx` — diagnostic widget for founding sponsor code.
- `CopyButton.tsx` — admin copy primitive.
- `forms.tsx` — shared admin form primitives.

### `sponsor/`
- `SponsorStrip.tsx`, `SponsorStripClient.tsx` — sponsor attribution display.

### `footer/`
- `PublicFooter.tsx`.

### Auth components — directly under `components/`
- `LoginForm.tsx`, `SignupForm.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`.

---

## 4. Compensation surface area

**Highest-risk section.** Every file below touches ranks, commissions, payouts, sponsor chain, or starter packages.

### Schema / RPC layer (`supabase/migrations/`)

| File | Why it's compensation-critical |
|---|---|
| `001_initial_schema.sql` | Creates `distributors`, `distributor_tree` (closure table, depth 0–7), `commission_ledger`, `monthly_salaries`, `rank_up_bonuses`, `payouts`, `gsv_snapshots`, and the `config_*` tables (`config_ranks`, `config_commission_rates`, `config_salary_tiers`, `config_starter_packages`). |
| `004_commission_ledger.sql` | RPC `write_commission_ledger(order_id)` — fans out commissions L1–L7 to the buyer's upline. |
| `005_provision_distributor.sql` | RPC `provision_distributor(order_id)` — creates the distributor row, inserts ancestor edges into the closure tree, grants the distributor role. |
| `006_monthly_close.sql` | RPCs: `compute_gsv_snapshot()`, `compute_monthly_salary()`, `detect_rank_up()`. The monthly-close brain. |
| `008_commission_clawback.sql` | RPC `void_unpaid_commissions_for_order(order_id)` — refund propagation into unpaid ledger rows. |
| `009_commission_compression.sql` | Extends `write_commission_ledger` to skip inactive uplines (compression). |
| `012_closure_table_extension.sql` | Lifts the closure-table depth cap from 7 to 14 to support compressed walks. |
| `013_comp_plan_rewrite.sql` | Comp plan v2: 8-rank schema, new commission/salary seed, `is_distributor_maintained()` RPC, rank + maintenance gates on `write_commission_ledger`. |
| `014_comp_plan_v2_pv.sql` | Adds Point Value (PV) columns to `product_variants`; introduces PV-based commission basis. |
| `015_qualifying_streak.sql` | Streak-tracking RPC for rank qualification. |
| `018_manual_ledger_adjustments.sql` | `manual_ledger_adjustments` table — admin overrides surfaced in payout drafts. |
| `022_eight_ranks.sql` (preexisting, NOT the same as our 022 webhook hotfix) | Lifts `rank_position` CHECK from 1..7 to 1..8 to admit the 8th rank. |

### App-server layer

- `src/lib/mlm/types.ts` — commission/rank/salary domain types.
- `src/lib/mlm/commission-calculator.ts` — client-side commission calc mirror of the SQL RPC.
- `src/lib/mlm/salary-calculator.ts` — qualification evaluator (personal bottles + team GSV vs tier thresholds).
- `src/lib/payouts/draft.ts` — `previewDraft()` aggregates unpaid commissions + salaries + rank bonuses + manual adjustments for a period.
- `src/lib/close/orchestrate.ts` — orchestrates the three monthly-close RPCs per active distributor.
- `src/lib/distributors/current.ts` — loads the current distributor row by `user_id` (sponsor, rank, payout MSISDN, starter timestamp).
- `src/app/api/distributor-signup/init/route.ts` — invite-only signup; enforces sponsor code, joining fee from `config_starter_packages`, stashes KYC into `orders.notes`.
- `src/app/api/checkout/init/route.ts` — sets `sponsor_distributor_id` on retail orders from the sponsor cookie.
- `src/app/api/cron/monthly-close/route.ts` — Vercel-cron entry.
- `src/app/api/payhero/payout-webhook/route.ts` — settles `payouts` rows.

### Admin UI

- `/admin/distributors`, `/admin/distributors/[id]`, `/admin/distributors/verifications` — distributor management + KYC.
- `/admin/payouts`, `/admin/payouts/new`, `/admin/payouts/[id]` — drafting + initiating + auditing payouts.
- `/admin/comp/starter-packages` — versioned `config_starter_packages.joining_fee_minor` editor.
- `/admin/close` — monthly close UI.
- `/admin/clawbacks` — clawback resolution queue.
- `/admin/people/tree` — full distributor tree.
- `/admin/analytics/cohorts` — lifetime ARPU per signup cohort.
- `/admin/orders/[id]` — refund flow restores inventory + voids unpaid commissions + queues `clawback_resolutions`. Plus the new **Reconcile PayHero payment** button added in this session.

### Distributor-facing UI

- `/account/distributor` — dashboard.
- `/account/distributor/commissions` — personal ledger.
- `/account/distributor/downline` — tree.
- `/account/distributor/share` — sponsor code + copy button.
- `/account/distributor/settings` + `/verify` — payout MSISDN.
- `/account/payouts` — personal payout history.

### Public marketing copy

- **`src/app/(public)/boss-scents/page.tsx`** — comp plan explainer. Single biggest concentration of legacy MLM vocabulary in the codebase (~62 hits across all flagged terms). This is the page most exposed to "feels like MLM" prospects.

### Other surfaces touching the comp plan

- `src/components/account/AffiliateUpgradeBanner.tsx` and `AccountStatusCard.tsx` — explicit mentions of "lifetime monthly salary up to Kes 250,000" and "Manager rank up qualifies for lifetime monthly salary".
- `src/components/admin/AdminSidebar.tsx` — exposes `/admin/comp/starter-packages` in the nav.
- `src/types/database.ts` — auto-generated types name every `config_*` and ledger table; rename here when DB column renames land.

---

## 5. Schema audit (compact)

Full per-column / per-policy / per-index detail in [docs/preflight-2026-05-schema-detail.md](preflight-2026-05-schema-detail.md). This table is the compact summary called for by §6.5 of the transformation prompt.

**Row counts** are intentionally blank — they require a live-DB query and are out of scope for this read-only preflight. Recommend the engineer run the supplied SQL in §5.1 below post-approval to fill them in before Phase 1.

### Tables

| Theme | Table | Created in | RLS | Key policies | Outgoing FKs (target tables) |
|---|---|---|---|---|---|
| Auth | `profiles` | `001` | ✓ | self-read, self-update, admin-all | `auth.users` |
| Auth | `user_roles` | `001` | ✓ | self-read, superadmin-all | `profiles` (×2) |
| Catalog | `categories` | `001` | ✓ | public-read-active, admin-write | `categories` (parent) |
| Catalog | `products` | `001` | ✓ | public-read-active, admin-write | `categories` |
| Catalog | `product_variants` | `001` (+`014` PV cols) | ✓ | public-read-active, admin-write | `products` |
| Catalog | `bundles` | `001` | ✓ | public-read-active, admin-write | — |
| Catalog | `bundle_items` | `001` | ✓ | public-read-all, admin-write | `bundles`, `product_variants` |
| Catalog | `product_images` | `002` | ✓ | public-read-all, admin-write | `products`, `product_variants` |
| Catalog | `bundle_images` | `002` | ✓ | public-read-all, admin-write | `bundles` |
| Orders | `addresses` | `001` | ✓ | self-all, admin-read | `profiles` |
| Orders | `orders` | `001` (+`019`/`020`/`021` cols) | ✓ | self-read, admin-all | `profiles`, `distributors`, `addresses` |
| Orders | `order_items` | `001` (+`014` PV col) | ✓ | self-read-via-order, admin-all | `orders`, `product_variants`, `bundles` |
| Compensation | `distributors` | `001` (+`010` MSISDN cols) | ✓ | self-read/update, downline-read, admin-all | `profiles`, `distributors` (sponsor), `bundles`, `config_ranks` |
| Compensation | `distributor_tree` | `001` (+`012` depth) | ✓ | self-read (anc or desc), admin-all | `distributors` (×2) |
| Compensation | `commission_ledger` | `001` (+`014` PV) | ✓ | self-read, admin-all | `distributors` (×2), `orders`, `config_commission_rates`, `payouts` |
| Compensation | `monthly_salaries` | `001` | ✓ | self-read, admin-all | `distributors`, `config_ranks`, `payouts` |
| Compensation | `rank_up_bonuses` | `001` | ✓ | self-read, admin-all | `distributors`, `config_ranks`, `payouts` |
| Compensation | `gsv_snapshots` | `001` / `006` | ✓ | self-read, admin-all | `distributors` |
| Compensation | `qualifying_streak_*` | `015` | ✓ | admin-all | `distributors` |
| Compensation | `manual_ledger_adjustments` | `018` | ✓ | admin-all | `distributors`, `payouts` |
| Config | `config_ranks` | `001` (+`022` 8th rank CHECK) | ✓ | public-read, superadmin-write | — |
| Config | `config_commission_rates` | `001` | ✓ | public-read, superadmin-write | `config_ranks` |
| Config | `config_salary_tiers` | `001` | ✓ | public-read, superadmin-write | `config_ranks` |
| Config | `config_starter_packages` | `001` | ✓ | public-read-active, admin-write | `bundles` |
| Payments | `payouts` | `001` (+`019` payhero cols) | ✓ | self-read, admin-all | `distributors` |
| Payments | `payment_attempts` | `019` | ✓ | self-read-via-order, admin-all | `orders` |
| Payments | `webhook_deliveries` | `019` (+`022` event_type/error backfill) | ✓ | admin-all | — |
| Payments | `clawback_resolutions` | `008`-area | ✓ | admin-all | `orders` |
| System | `audit_log` | `001` | ✓ | admin-all | `profiles` (actor) |

### Enums

- `user_role` (`001`) — `customer | distributor | admin | superadmin`.
- `order_kind` (`001`) — `retail | distributor_signup | distributor_restock`.
- `order_status` (`001`, + `021` adds `expired`) — `pending | paid | failed | cancelled | fulfilled | shipped | delivered | refunded | expired`.

### RPCs / functions (high-value)

- **Idempotency:** `record_webhook_delivery(provider, event_id, event_type, signature_ok, body)` and `mark_webhook_processed(provider, event_id, error)` (`019`).
- **Order lifecycle:** `generate_order_number()` (`003`), `mark_order_paid(order_id, provider_ref, paid_at)` (`003`), `restore_order_inventory(order_id)` (refund path).
- **Distributor lifecycle:** `provision_distributor(order_id)` (`005`), `write_commission_ledger(order_id)` (`004`/`009`/`013`), `void_unpaid_commissions_for_order(order_id)` (`008`).
- **Monthly close:** `compute_gsv_snapshot(...)`, `compute_monthly_salary(...)`, `detect_rank_up(...)`, `is_distributor_maintained(...)` (`006`/`013`).
- **Role check:** `has_role(text)` — used in nearly every RLS policy.
- **House-keeping:** `set_updated_at()` trigger fn.

### Migration timeline (one-liners)

- `001` — Initial schema (everything above, plus FKs deferred where circular).
- `002` — Catalog image renditions (`product_images`, `bundle_images`).
- `003` — Order-number generation + `mark_order_paid` RPC.
- `004` — `write_commission_ledger` RPC.
- `005` — `provision_distributor` RPC.
- `006` — Monthly close RPCs.
- `007` — (Various seed / config tweaks — verify in file if material.)
- `008` — Commission clawback RPC + table.
- `009` — Commission compression in upline walk.
- `010` — Pending payout MSISDN columns + index.
- `011` — (Migration in series — verify.)
- `012` — Closure table depth 7 → 14.
- `013` — Comp plan v2 (8-rank scheme + maintenance gates).
- `014` — Point Value columns + PV-based commissions.
- `015` — Qualifying streak.
- `016`–`017` — (Verify.)
- `018` — Manual ledger adjustments.
- `019` — PayHero schema (webhook_deliveries, payment_attempts, payhero_* columns, idempotency RPCs).
- `020` — `orders.processing_fee_minor` for PayHero fee passthrough.
- `021` — `order_status='expired'` + partial unique indexes for one-pending-order-per-(user, kind). Also backfills pre-fix duplicate pending rows to `cancelled`.
- `022` — `webhook_deliveries.event_type` + `.error` schema drift hotfix.

### 5.1 — SQL the engineer should run before Phase 1

```sql
-- Approx row counts per table — fill into the schema table above
SELECT relname AS table_name, n_live_tup AS approx_rows
  FROM pg_stat_user_tables
 WHERE schemaname = 'public'
 ORDER BY n_live_tup DESC;
```

```sql
-- Confirm RLS is ON for every public table (any FALSE here is a Phase 0 finding)
SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
 WHERE c.relkind = 'r' AND n.nspname = 'public'
 ORDER BY c.relname;
```

```sql
-- Enumerate every policy (sanity check against the table above)
SELECT schemaname, tablename, policyname, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;
```

---

## 6. Copy audit — legacy MLM vocabulary

Grepped case-insensitive across `src/**` for the §3 transformation-prompt term list. Full file-by-file hit list lives at the bottom of the [schema-detail sibling doc](preflight-2026-05-schema-detail.md) (sized to avoid bloating this index). Headline numbers:

### Top terms by frequency

| Term | Hits | Top files |
|---|---|---|
| `rank` | 142 | `src/types/database.ts` (20), `boss-scents/page.tsx`, every distributor admin page. ⚠ many are legit (`config_ranks` DB column) — distinguish during refactor. |
| `starter` | 52 | `database.ts` (8), `config_starter_packages`-related code + `is_starter_package` flag, signup pages. |
| `downline` | 48 | `boss-scents/page.tsx` (8), `account/distributor/downline/page.tsx`, `admin/people/tree`. |
| `salary` | 37 | `database.ts` (8), `boss-scents/page.tsx` (8), payout files, `lib/mlm/salary-calculator.ts`. |
| `recruit` | 12 | `boss-scents/page.tsx` (5), `share/page.tsx`, dashboard. |
| `upline` | 13 | mostly migration doc-comments + `boss-scents/page.tsx`. |
| `PV` | 11 | `boss-scents/page.tsx` (10), `014_comp_plan_v2_pv.sql`. |
| `lifetime` | 10 | `boss-scents/page.tsx` (4), `AffiliateUpgradeBanner.tsx`, `AccountStatusCard.tsx`. |
| `MLM` | 7 | `src/lib/mlm/types.ts` (1 comment), 4 migration doc-comments, `README.md`. |
| `Team Builder` | 2 | both in `boss-scents/page.tsx` — current rank-1 name in the 8-rank scheme. |
| `director`, `network marketing`, `uplink` | 0 | — |

### Top 5 files by total legacy-vocab hit count

1. `src/app/(public)/boss-scents/page.tsx` — **62 hits**. Single largest customer-facing concentration. Refactor priority #1 for §5 copy work.
2. `src/types/database.ts` — 38 hits. Auto-generated from schema; touches change only when DB column names change.
3. `supabase/migrations/*.sql` — 34 hits, mostly doc-comments. Renaming these requires migration rewrites (high risk).
4. `src/app/(admin)/admin/distributors/[id]/page.tsx` — 18 hits. Admin-only surface.
5. `src/app/(public)/account/distributor/page.tsx` — 16 hits. Distributor-facing dashboard.

### What this means for Phase 1

- **Customer-facing rewrite scope:** `boss-scents/page.tsx`, `AffiliateUpgradeBanner.tsx`, `AccountStatusCard.tsx`, `distributors/signup/page.tsx`, and the `/account/distributor/*` page tree. These are pure copy + small structural edits — no schema impact.
- **Admin & ops surfaces:** keep current vocabulary intact for v1 of the refactor (admins benefit from precise legacy terms; partners never see these screens).
- **Schema-renaming track:** defer per §5 of the transformation prompt (the prompt itself says "produce a migration plan but do not run destructive migrations yet — propose, wait for approval"). The compact rename list will be the Phase-1 deliverable `MIGRATION_NOTES.md`.

---

## 7. Tailwind token audit

### Theme tokens (HSL via CSS vars in `src/app/globals.css` :root)

| Token | HSL | Purpose |
|---|---|---|
| `--background` | 24 16% 5% | Warm near-black primary bg. |
| `--foreground` | 36 33% 94% | Warm cream/off-white text. |
| `--muted` | 24 10% 11% | Card/section backgrounds. |
| `--muted-foreground` | 36 14% 68% | Secondary copy. |
| `--primary` | 38 56% 60% | Champagne gold accent. |
| `--primary-foreground` | 24 16% 6% | Text on primary. |
| `--accent` | 0 55% 45% | Deep oxblood/burgundy. |
| `--accent-foreground` | 36 33% 94% | Text on accent. |
| `--border` | 24 10% 16% | Borders. |
| `--ring` | 38 56% 60% | Focus ring. |
| `--radius` | `0.375rem` | Base radius (6 px). `md` = -2 px, `sm` = -4 px. |

### Tailwind config extensions (`tailwind.config.ts`)

- `colors:` background, foreground, muted, primary, accent, border, ring (all CSS-var-driven).
- `borderRadius:` `lg = var(--radius)`, `md = calc(var(--radius) - 2px)`, `sm = calc(var(--radius) - 4px)`.
- `fontFamily:` `sans = var(--font-sans)` (Inter), `serif = var(--font-serif)` (Cormorant Garamond).
- `keyframes.marquee-x:` 0% → -50% translateX.
- `animation.marquee-x:` `38s linear infinite`.

### Plugins

- `tailwindcss-animate`.

### Custom utilities (`globals.css` layers)

- `.text-eyebrow` — `0.7rem` uppercase, `0.32em` letter-spacing, primary color.
- `.hairline` — 1 px top divider.
- Scrollbar styling (thin, gold thumb).
- Font-feature-settings `'rlig' 1, 'calt' 1, 'ss01' 1` + `optimizeLegibility` + antialiasing.
- Background: two radial gradients (gold top-left, oxblood bottom-right; 4–5 % opacity; `background-attachment: fixed`).
- `.custom-cursor-ring.ring-hovered` — 64 px ring at primary 8% opacity (residual from removed custom-cursor experiment per HANDOFF.md).

### Container

- `center: true`, `padding: 2rem`, `screens: { '2xl': '1400px' }`.

### Dark mode

- `darkMode: ['class']` — class-based, controlled via `next-themes`. The whole site is already dark-on-dark by default; the toggle is dormant.

### `loveli-*` utility audit

- Grep across `src/**/*.{ts,tsx}` for `loveli-` returned exactly one literal: the cart store key `loveli-cart-v1` in `src/lib/cart/store.ts`. **No `loveli-*` Tailwind class names referenced anywhere.** The prior "Tailwind token mismatch" concern flagged in the transformation prompt does not apply to the current codebase.

---

## 8. Performance baseline (Lighthouse mobile)

Run with `npx lighthouse <URL> --only-categories=performance,accessibility,best-practices,seo --emulated-form-factor=mobile --chrome-flags="--headless --no-sandbox"` on 2026-05-18, fetching the prod deploy at `loveli-luxury-r6ij6rqne-theeashishs-projects.vercel.app`.

### Homepage — `/`

| Score | |
|---|---|
| Performance | **84** |
| Accessibility | **100** |
| Best Practices | **96** |
| SEO | **100** |

Core metrics: LCP **2.8 s** · TBT **30 ms** · CLS **0** · FCP **2.1 s** · SI **13.8 s** · TTI **3.2 s**.

### Product detail — `/p/rose-noir`

| Score | |
|---|---|
| Performance | **86** |
| Accessibility | **100** |
| Best Practices | **96** |
| SEO | **91** |

Core metrics: LCP **2.8 s** · TBT **100 ms** · CLS **0** · FCP **1.4 s** · SI **10.4 s** · TTI **2.8 s**.

### Versus §9 Phase 5 targets

| Target (§9) | Home now | PDP now | Gap |
|---|---|---|---|
| Performance ≥ 90 | 84 | 86 | -6 / -4 |
| Accessibility ≥ 95 | 100 | 100 | ✓ |
| Best Practices ≥ 95 | 96 | 96 | ✓ |
| SEO ≥ 95 | 100 | 91 | ✓ / -4 |
| LCP < 2.5 s | 2.8 s | 2.8 s | -0.3 s on both |
| TBT < 200 ms | 30 ms | 100 ms | ✓ |

Headline gap: **Performance and LCP** on both pages, **SEO** on the PDP. Speed Index is the biggest contributor — Home SI is 13.8 s, which suggests visual completeness lags despite a fast FCP (2.1 s) and low TBT (30 ms). LCP at 2.8 s indicates the hero image / Bond Bay cinematic isn't yet served as the optimal `srcset` AVIF + preload. PDP SEO at 91 is likely missing structured-data (Product schema, breadcrumbs).

Phase 5 will close these gaps via the §9 method list (AVIF + WebP responsive `srcset`, lazy below-the-fold, route-level code split, third-party script audit, skeleton states).

### Lighthouse JSON artifacts

- `lighthouse-home.json` (460 KB) — saved at repo root for trend comparison.
- `lighthouse-pdp.json` — saved at repo root.

Both are uncommitted — recommend adding to `.gitignore` (or moving under `docs/perf-baselines/2026-05-18/`) before the next commit.

---

## Done — what comes next

This preflight is the §4 deliverable. No source files were modified by it. Migration files 021 and 022 in this repo were authored during the prior PayHero incident, not by this audit, and are listed here only because they're already applied to prod.

Per §4 of the transformation prompt: **wait for owner sign-off before Phase 1 (Terminology & Positioning Refactor) begins.** When sign-off arrives, Phase 1 will:

- Operate on `main` directly (per saved feedback memory).
- Mint `docs/MIGRATION_NOTES.md` for the proposed `downline_count` / `rank_id` / etc. schema renames — non-destructive proposal only.
- Replace `boss-scents/page.tsx` copy first (largest single concentration of legacy vocabulary, customer-facing).
- Touch `AffiliateUpgradeBanner.tsx`, `AccountStatusCard.tsx`, `distributors/signup/page.tsx`, and the `/account/distributor/*` page copy in the same branch.
- Leave admin surfaces, `src/types/database.ts`, and migration doc-comments untouched in Phase 1.
- Defer the `/mlm` → `/partners` slug rename per §5 if any URL is currently `/mlm`-prefixed (a quick grep of the route map above confirms it isn't — the closest are `/distributors/*` and `/account/distributor`; rename here means renaming the `distributors` segment, which is a larger change worth its own plan).

Open questions for sign-off:

1. Are the **8-rank names** (Team Builder, Team Leader, Supervisor, Manager, Senior Manager, Executive Manager, Legacy Builder, Ambassador) the names the new copy should retain, or should Phase 1 propose new ones aligned with the §3 ladder (Affiliate → Brand Partner → Executive Partner → Prestige Partner)? The schema currently has 8 ranks, the §3 vocabulary has 4 tiers — they don't map 1:1.
2. Is the `/distributors/signup` route slug acceptable for v1, or should §5's `/partners` or `/ambassadors` rename land in Phase 1?
3. The §3 table lists "Performance retention bonus (quarterly reviewed, sales-tied)" replacing "Lifetime salary". The current schema has `monthly_salaries` with `fixed_salary_minor` + `performance_bonus_minor`. Schema-rename plan in `MIGRATION_NOTES.md` should propose `monthly_salaries` → `retention_bonus_grants` (per §6.3 of the transformation prompt) — confirm or adjust.
4. The 4-tier scheme in §3 implies collapsing the existing 8 ranks. Is that desired, or do we keep 8 ranks internally and present them as 4 marketing-facing tiers? (The latter is less disruptive to existing distributors.)
