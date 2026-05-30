# Loveli Luxury — Website Review (100-question audit)

**Reviewer:** Claude (Opus 4.8) · **Date:** 2026-05-30
**Scope:** the live platform in `loveli-luxury/` (Next.js 14 + Supabase + PayHero), reviewed against the canonical docs and the actual source.
**Method:** read the code and config (not just the docs), ran the test suite, parsed the on-disk Lighthouse reports, inspected the schema/migrations, checked git state.

---

## Executive verdict

This is a **genuinely well-engineered, well-documented platform** — not a scaffold. Security posture, payment integrity, the money model, RLS coverage, and documentation are all above the bar for a project this size. The honest gaps are about **launch-readiness and operations**, not core architecture: payments are on sandbox, the catalog is ~2 test products, performance sits just below target on the target network, automated testing covers only the pure-logic core (no E2E, routes/components/DB untested), and the working tree has **174 uncommitted files against a dormant git remote** so the ops/rollback story is weak.

### Category scorecard

| Area | Grade | One-line |
|---|---|---|
| Business & product clarity | A | Strategy is explicit, documented, and enforced in code |
| Design & UX | B+ | Coherent design system; perf + real photography are the gaps |
| Performance | B | Home 84 / PDP 86 Lighthouse; LCP 2.8s vs 2.5s target |
| Frontend architecture | A− | RSC-first, clean lib boundaries; React Query unused |
| Backend architecture | A | RPC-enforced money paths, idempotent webhooks, Zod everywhere |
| Database | A | RLS on every table, versioned config, money in minor units |
| Security | A− | Strict CSP/HSTS, timing-safe webhook, RLS; a few Supabase advisors open |
| SEO | B+ | Metadata/sitemap/robots/PDP JSON-LD solid; thin homepage schema |
| Infra & DevOps | C+ | Managed stack is fine; **no live CI, uncommitted code, manual deploys** |
| Quality assurance | C+ | 355 unit tests pass, but only over 17 lib files; no E2E/integration |
| Maintainability | B+ | Excellent docs; some stale docs + Flutterwave dead refs |
| Commercial readiness | C | Architecturally ready; operationally + content-wise not launch-ready |

---

# Business & Product

**1. What problem does this website solve?**
It sells premium Eau de Parfum to a Kenya / East Africa, mobile-first, M-Pesa-paying audience, and bolts on an **invite-only partner (MLM) program** so customers can build a fragrance business. The hard product problem it solves is *carrying an MLM without looking like a pyramid*: the store is the only funnel entrance and the partner program is "a door, not a hallway" (`docs/transformation-masterplan-2026-05.md` §"core strategic resolution"; `docs/PROJECT-BRIEF.md`).

**2. Who is the primary target audience?**
Two segments, deliberately separated: (a) **retail fragrance buyers** in Kenya/East Africa on 4G phones paying via M-Pesa; (b) **prospective partners** who arrive by invite/sponsor code. Customer register = "scent, mood, presence, trust"; partner register = "craft, curation, legacy" (masterplan §2–3, §8).

**3. Top 3 user actions the site is designed to drive?**
(1) Browse → PDP → cart → **M-Pesa checkout** (retail purchase); (2) **invite-only partner signup** with a sponsor code; (3) trust-building actions (order tracking, WhatsApp concierge, reading authenticity/refund policies). The hero is single-CTA and deliberately *not* a recruitment CTA (masterplan §2, §7).

**4. How is success measured?**
The repo does **not** define explicit KPIs/targets in code or docs — there is no analytics dashboard or stated conversion goal. Measurement *infrastructure* exists (GA4 / Meta / TikTok pixel env hooks in `src/lib/env.ts`; Sentry) but success criteria are implicit (orders paid, partners provisioned, commission ledger written). **Gap:** no documented success metrics or funnel targets.

**5. What business goals does each major page support?**
Home = trust-in-5-seconds + product discovery + discreet partner teaser; `/shop` + `/p/[slug]` = retail conversion; `/bundles` = AOV/upsell; `/partners` = aspiration + invite (no rates shown — pricing moved behind login to `/account/partner/earnings`); `/policies/*`, `/story`, `/track` = trust scaffolding; `/account/partner/*` = retention + earnings; `/admin/*` = back-office ops (masterplan §2, Appendix C "privacy redesign").

**6. Which user pain points were identified before development?**
Documented in the brand brief + masterplan §1/§7: MLM "pyramid optics," half-finished terminology reading as *more* suspicious, missing trust signals on first paint, and 4G performance/bandwidth on the Kenyan mobile audience. The "luxury ⇄ MLM" tension is named as "the single hardest problem."

**7. What research informed the design decisions?**
An owner-delivered **brand brief (2026-05-18)** (positioning, vocabulary kill-list, compensation rules, UI restraint, PDP mandatory fields), a Phase-0 **preflight inventory** (`docs/preflight-2026-05.md`), and a named visual reference (`mondedesparfum.com`) that drove the dark→light theme flip (Appendix E). This is competitor/heuristic + stakeholder research, **not** documented usability studies.

---

# Design & UX

**8. Why was this color system chosen?**
Light "premium" palette — soft cream `#F5F3EF`, warm-charcoal ink, antique-gold accent, warm-brown — chosen to match the owner's photography-led reference and read as restrained luxury (not "gold-drenched stat casino"). Tokens are HSL CSS variables in `src/app/globals.css`; convention is **charcoal = primary CTA, gold = accents only** (Appendix E). It overrode an earlier dark palette by explicit owner decision.

**9. What accessibility standards were followed?**
No formal WCAG conformance statement, but **Lighthouse Accessibility = 1.00 (100)** on both Home and PDP (`lighthouse-home.json`, `lighthouse-pdp.json`). Semantic headings, font `display: swap`, focus-visible rings via `--ring`, `maximumScale: 5` (doesn't block zoom), `lang="en"`. **Gap:** no axe/manual a11y audit, no documented screen-reader testing.

**10. How does the design scale across mobile/tablet/desktop?**
Mobile-first Tailwind with responsive breakpoints throughout; dedicated mobile nav drawer (`MobileMenu.tsx`), a deliberate 3-tier vertical-rhythm scale (`py-14` strips → `md:py-40` content → `md:py-48` editorial), and `next/image` device sizes narrowed to common phone→laptop widths `[360,414,480,768,1024,1280,1920]` (`next.config.js`). Hero uses `min-h-[90vh]` with responsive padding (Appendix F).

**11. What user testing was conducted?**
None documented. Verification is engineer-run: typecheck, 355 unit tests, `next build`, and live HTTP/HTML probes after each deploy. **Gap:** no moderated usability testing, no A/B tests.

**12. What evidence supports the current navigation structure?**
Brand-brief-driven, not test-driven. The masterplan explicitly flags an **open IA question**: the always-on header "Partners" pill plus the signed-in `AffiliateUpgradeLink` is "mild redundancy — consider demoting the pill to keep the program a discreet door" (§2). So nav is reasoned but self-identified as unsettled.

**13. What are the conversion paths?**
Retail: Home/`/shop` → `/p/[slug]` → add to cart (`CartDrawer`) → `/checkout` → STK push (`StkPushPanel`) → `/checkout/return`. Partner: invite link `/r/[code]` (sets `ll_sponsor` cookie, 30-day first-touch attribution in `src/middleware.ts`) → `/partners` → `/partners/signup` (auth-gated) → provisioned on paid signup order. Alternative low-friction path: "Order via WhatsApp" concierge link on PDPs.

**14. Which pages have the highest cognitive load and how was it reduced?**
The **PDP** (fragrance notes, longevity, projection, occasions, reviews, similar products) and the **partner comp plan**. PDP load was reduced by hiding empty metadata sections, restructuring notes into a stacked "pyramid," and a gallery-weighted two-column layout (Appendix B, O, Q). Comp-plan load was reduced by showing **tier names only** publicly and moving all rates/margins behind the partner login (Appendix C).

**15. What design system exists behind the UI?**
A lightweight token-based system: HSL CSS variables (`globals.css`), Tailwind config mapping them (`tailwind.config.ts`), `class-variance-authority` + `tailwind-merge` for variants, `lucide-react` icons, Cormorant Garamond (serif display) + Inter (sans body) via `next/font`, and reusable primitives (`.text-eyebrow`, `.hairline`). It's a convention-driven system rather than a published component library (no Storybook).

---

# Performance

> Source: on-disk Lighthouse runs `lighthouse-home.json` / `lighthouse-pdp.json`, captured 2026-05-18 (mobile profile).

**16. Lighthouse performance score?** Home **84**, PDP **86** (target ≥90 — *not yet met*). Accessibility 100, Best-Practices 96, SEO 100 (home) / 91 (PDP).

**17. Largest Contentful Paint (LCP)?** **2.8 s** on both pages (target <2.5 s — *just over*). Prime suspect documented as the hero's multi-image client crossfade; mitigations shipped (defer-mount non-LCP images, preload the one priority image) but the 2.8s figure predates a confirming re-run.

**18. First Contentful Paint (FCP)?** Home **2.1 s**, PDP **1.4 s**.

**19. Total Blocking Time (TBT)?** Home **30 ms**, PDP **100 ms** — both excellent. (CLS = 0 on both.)

**20. Image optimizations?** `next/image` with AVIF/WebP, narrowed `deviceSizes`/`imageSizes`, `minimumCacheTTL = 31536000` (1 year edge cache), `quality={65}` on grid thumbnails, `priority` + preload on the LCP hero image, `sharp` for build-time transforms (`next.config.js`, Appendix I). **Caveat:** the 9 homepage images are off-brand AI composites with burned-in text — a render brief exists to replace them (`docs/photography-render-brief-2026-05.md`).

**21. What assets are lazy-loaded?** Below-the-fold images (default `next/image` lazy), and the WhatsApp concierge + wishlist hydrator are `dynamic(..., { ssr:false, loading: () => null })` so they ship after hydration, off the pre-LCP JS path (Appendix I).

**22. Total page weight?** Home **~640 KiB**, PDP **~300 KiB** (Lighthouse `total-byte-weight`). Sentry adds ~60 kB to the shared client bundle even when inert (punch-list P1 note).

**23. HTTP requests on initial load?** Home **29**, PDP **25** (Lighthouse `network-requests`).

**24. Caching strategy?** ISR for catalog (`sitemap` `revalidate=3600`; on-demand `POST /api/revalidate` with a bearer secret; `revalidatePath` after admin writes), 1-year immutable edge cache for optimized images, Vercel CDN edge caching, `next/font` self-hosting. Static homepage is statically cached and busted on CMS edits.

**25. What happens on a slow 3G connection?** No offline/PWA/service-worker fallback. Lighthouse `speed-index` is poor (13.8s home / 10.4s PDP) under heavy throttling — meaningful content is delayed though FCP/LCP are moderate. The app degrades functionally (server-rendered HTML arrives, images stream in progressively) but there is **no explicit slow-network strategy** beyond image optimization. This is the single biggest perf risk for the actual target audience.

---

# Frontend Architecture

**26. Why was the framework chosen?** Next.js 14 App Router for RSC-first rendering (less client JS on a 4G audience), built-in image optimization, file-based routing, server actions for mutations, and first-class Vercel hosting. Documented as the stack baseline (`README.md`, masterplan §6).

**27. Component architecture?** React Server Components by default; client components only where interactivity demands (`'use client'` in cart, forms, hero rotation, quiz). Components organized by domain under `src/components/*` (account, admin, auth, cart, catalog, checkout, home, header, footer, etc.), with business logic pushed down into `src/lib/*`. 65 page routes, 12 API routes, 20 files using server actions.

**28. How is state managed?** Three layers: (a) **server state** via RSC + server actions (the default); (b) **client UI state** via **Zustand** — 3 stores: cart (`src/lib/cart/store.ts`), wishlist, recently-viewed, persisted to localStorage; (c) URL/cookie state (sponsor attribution cookie). **Note:** `@tanstack/react-query` is in `package.json` and named in the docs, but has **0 imports in `src/`** — installed but unused (overstated in the masterplan).

**29. How are reusable components organized?** By feature domain under `src/components/`, with pure logic extracted to `src/lib/<domain>/` (e.g. `cart/logic.ts`, `cart/selectors.ts`) so it's unit-testable in plain Node. Shared UI atoms live in `components/admin/forms.tsx`, `content/HighlightText.tsx`, etc.

**30. What prevents code duplication?** The big example is `src/lib/payments/apply-payment-success.ts`, which collapsed an identical ~70-line post-payment chain that had been copy-pasted across **5 call sites** (webhook, reconcile API, admin action, status self-heal, cron) into one helper (Appendix J). Generally, logic lives in `lib/`, consumed by thin routes/components. `clsx`/`tailwind-merge` dedupe styling.

**31. What frontend standards are enforced?** TypeScript **strict** (`tsconfig.json`), ESLint (`next/core-web-vitals` + `eslint-plugin-security`), Prettier-style conventions, a **Husky pre-commit hook** running `eslint --fix` + a secret scanner via `lint-staged`, and a documented copy standard (no em-dashes, banned "AI-slop" words). Note: `next.config.js` sets `eslint.ignoreDuringBuilds = true` — lint is enforced in CI/pre-commit, not at build.

**32. How are forms validated?** Two-tier: **Zod** schemas validate on the server (every API route + server action), and **react-hook-form + @hookform/resolvers (zodResolver)** on the client for 3 auth forms. Server-side validation is authoritative — e.g. checkout re-prices the entire untrusted cart against the DB rather than trusting client totals (`src/app/api/checkout/init/route.ts`).

**33. How is error handling implemented?** API routes return structured JSON with correct status codes (400/401/409/429/500/502) and never leak internals; payment-provider failures return 502; idempotency conflicts return 409. **Sentry** captures client+server+edge errors (`sentry.*.config.ts`, `src/instrumentation.ts`). Non-fatal side-effects (receipt email, audit) are best-effort and warn rather than throw. CMS reads fall back to in-code defaults on any parse failure ("a bad edit cannot break the site," Appendix L).

**34. What technical debt currently exists?** (a) ~22 files use `as unknown as` casts around newer tables (being unwound, Appendix Q); (b) **Flutterwave dead references** in 15 files (column names `flutterwave_transfer_id`, comments, `.env.example`) though PayHero is the only live provider; (c) React Query installed-but-unused; (d) stale `.env.example` (documents Flutterwave, omits PayHero/Upstash/MFA vars); (e) `database.ts` widened with `_minor: string | number` unions because the generator emits BIGINT as `number`.

**35. What parts of the frontend are most difficult to maintain?** The **checkout/idempotency flow** (`checkout/init/route.ts` is ~630 lines with reuse/expire/refire branches and inline typed casts), the **admin comp surfaces** (versioned config rows, rank math), and the **Hero** (client bottle rotation entangled with LCP-priority logic). These are the highest-logic, highest-cast areas.

---

# Backend Architecture

**36. Complete backend stack?** Next.js route handlers + server actions (Node runtime) · **Supabase** (Postgres 15, Auth, Storage, RLS) · **PayHero** (M-Pesa STK push + B2C payouts, fronting Safaricom Daraja) · **Upstash Redis** (rate limiting) · **Resend** (transactional email) · **Africa's Talking** (SMS, optional) · **Sentry** (errors) · Vercel Cron (scheduled jobs). All config is env-validated through `src/lib/env.ts` (Zod).

**37. Why this stack?** Managed/serverless to keep ops light for a solo-dev workflow; Supabase gives Postgres + Auth + RLS + Storage in one; PayHero is the pragmatic M-Pesa gateway for Kenya; everything else is "activate by setting an env var, no-op until then" so the platform ships inert and lights up on configuration (punch-list P1, env activations table).

**38. How are APIs structured?** REST-ish route handlers under `src/app/api/*`: `checkout/init`, `partner-signup/init`, `payhero/{webhook,status,reconcile,retry-stk,payout-webhook}`, `cron/{monthly-close,commission-reconcile,reconcile-pending}`, `revalidate`, `wishlist`. Mutations that aren't public APIs use **server actions** (20 files). Money-touching paths go through **Postgres RPCs** (`mark_order_paid`, `write_commission_ledger`, `provision_distributor`, `generate_order_number`), not ad-hoc SQL.

**39. How is authentication handled?** Supabase Auth (cookie-based SSR sessions via `@supabase/ssr`). `src/middleware.ts` refreshes the session on every request and gates auth-required prefixes (`/account`, `/checkout`, `/partners/signup`) and all of `/admin`. Server code resolves identity via `getSession()` in `src/lib/auth/roles.ts`.

**40. How is authorization handled?** Defense-in-depth: (1) **middleware** route gate checks `user_roles` for `admin`/`superadmin`; (2) **layout + server actions** re-assert via `requireAdmin()` / `requireSuperadmin()`; (3) **Postgres RLS** is the backstop — every table has policies keyed on `has_role(...)` and `auth.uid()`. A user could bypass the UI and still be stopped by RLS at the database.

**41. What rate limiting exists?** Upstash sliding-window limiter (`src/lib/ratelimit.ts`), **fail-open**: `/api/checkout/init` 5/60s, `/api/partner-signup/init` 3/60s, keyed on client IP. The payment **webhook is deliberately excluded** (token-gated; rate-limiting a payment callback is riskier than the abuse). No global limiter — only the two abuse-prone init routes.

**42. How are secrets managed?** Vercel env vars, split into `publicEnv` (NEXT_PUBLIC_*) and server-only `getServerEnv()` with a runtime browser-access guard (`src/lib/env.ts`). A repo secret scanner (`scripts/check-secrets.sh`) runs in pre-commit and CI, plus **TruffleHog** in CI. `.env.local` is gitignored. The service-role key is isolated to `src/lib/supabase/service.ts` with explicit "never import in browser/middleware" guardrails.

**43. What happens when an API fails?** Structured error + correct status, no state mutation on the unhappy path. Payments specifically: the webhook is the *only* thing that flips order state; on apply-failure it records the delivery and returns 500 so PayHero retries; duplicates ack 200; unknown orders ack 200; amount-mismatch returns 400. Checkout cleans up orphaned orders if item insert fails. Self-healing reconcile paths (status-poll, cron sweeper, admin reconcile) catch payments the webhook missed.

**44. How are database queries optimized?** Closure table (`distributor_tree`) gives O(1) ancestor lookups instead of recursive CTEs; **denormalized `gsv_snapshots`** precompute monthly totals so dashboards don't walk the tree; bulk `.in(...)` reads in checkout/similar-products instead of N+1; partial indexes on hot predicates (unpaid commissions, active distributors, pending orders). Catalog reads are ISR-cached.

**45. What bottlenecks have been identified?** Documented: the hero image payload (LCP); the (now-fixed) `payment_attempts` column drift that silently dropped the audit trail (Appendix G); RLS recursion on `distributors` that caused "infinite recursion" in Postgres logs until hoisted into a `SECURITY DEFINER` helper (Appendix J). Not load-tested, so no throughput bottleneck data exists.

---

# Database

**46. Why this database chosen?** Postgres (via Supabase) for relational integrity on money/commission data, native RLS for multi-tenant authorization, transactional RPCs for the payment→ledger chain, and the closure-table pattern for the MLM tree. Money correctness drove it: **all amounts are BIGINT minor units** (cents) to avoid float errors in commission math (`001_initial_schema.sql` header).

**47. Show the database schema.** Core tables (from `supabase/migrations/001` + 38 later migrations):
- **Auth/profiles:** `profiles`, `user_roles` (enum `customer|distributor|admin|superadmin`).
- **Catalog:** `categories`, `products`, `product_variants` (+`pv_per_bottle`, retail/distributor price minor), `bundles`, `bundle_items`, `product_fragrance_meta` (028), `homepage_reviews` (026/038), `press_features`, `site_content` (035/037/039 CMS).
- **Commerce:** `addresses`, `orders` (enums `order_status`, `order_kind`; +`processing_fee_minor`, `payment_provider`), `order_items`, `payment_attempts`, `webhook_deliveries`.
- **MLM:** `distributors`, `distributor_tree` (closure, depth 0–7→14), `commission_ledger`, `monthly_salaries`, `rank_up_bonuses`, `payouts`, `gsv_snapshots`, `msisdn_verifications` (016), `clawback_resolutions` (011).
- **Config (versioned):** `config_commission_rates`, `config_ranks` (+`min_active_customers`, `maintenance_grace_months`), `config_salary_tiers`, `config_starter_packages`.
- **Audit:** `audit_log`, `payment_audit_logs`.
Full DDL in `supabase/migrations/`. *(Note: 001 seeds an 8-rank/L1–L7 scheme; migrations 029/036 reconfigured it to the live 5-rank / L1–L5 PV plan.)*

**48. What indexes have been implemented?** Many, including partial indexes: `idx_user_roles_active` (WHERE revoked_at IS NULL), `idx_orders_{user_created,status_created,sponsor,payment_ref}`, `idx_order_items_order`, `idx_distributors_{sponsor,active,rank}`, `idx_tree_{descendant_depth,ancestor_depth}`, `idx_commission_{distributor_earned,unpaid,source_order}`, `idx_payouts_{status,distributor_period}`, `idx_audit_{actor_time,resource}`, plus partial unique `idx_orders_one_pending_retail_per_user` (021) enforcing checkout idempotency. Config "active row" partial indexes (WHERE effective_until IS NULL).

**49. How is data integrity enforced?** FK constraints throughout, CHECK constraints (`total_minor >= 0`, `quantity > 0`, `depth BETWEEN 0 AND 7`, `one_item_type` XOR on order_items, `effective_until > effective_from`), UNIQUE constraints (order_number, sponsor_code, one bonus per rank, one salary per period), enums for status fields, and the **versioned-config pattern** (rows immutable; edits insert new rows) so historical commissions stay calculable on the rate effective at the time.

**50. How are backups performed?** **Not in the repo's control** — this is Supabase's managed backup (automatic daily backups; PITR on Pro+ plans). **Gap:** backup cadence/retention/restore-tested status is *not documented anywhere in the repo*, and given 174 uncommitted files (below), the application code is not independently backed up in git.

**51. Disaster recovery process?** None documented. Implicit DR = Supabase managed restore + Vercel redeploy. The PayHero runbook documents a payments **rollback** (restore sandbox env vars + redeploy, no code change) but there is **no DR runbook** for data loss, and no tested restore. This is a real commercial-readiness gap.

**52. Largest table and why?** With current data everything is tiny (~5 distributors, ~15–20 orders). *By design*, the tables that grow fastest are **`distributor_tree`** (closure table — one row per ancestor×descendant pair, so O(n·depth) fan-out), **`commission_ledger`** (up to 5 rows per commissionable order), and **`audit_log`** (every config edit + payment now writes a row). At scale `distributor_tree` is the structural giant.

**53. How are migrations handled?** Plain numbered SQL files in `supabase/migrations/` (001→039), applied via the Supabase MCP/CLI, each idempotent-leaning and verified live. Config changes use **versioned inserts** not in-place updates. A documented lesson: `CREATE TABLE IF NOT EXISTS` does *not* reconcile columns → use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (the `payment_attempts` drift bug, migration 030 / Appendix G).

**54. What prevents duplicate data?** UNIQUE constraints (order_number, sponsor_code, sku, email, `(distributor, period)` on salaries/payouts, `(distributor, rank)` on bonuses), the `webhook_deliveries` dedup table (UNIQUE event id → replay-safe webhooks), the partial unique index preventing two pending retail orders per user, and idempotent RPCs (`mark_order_paid` is a no-op if already paid).

**55. What database performance monitoring exists?** Supabase's built-in dashboard (query stats, advisors) + Supabase **security/performance advisors** (referenced in Appendix I/J). There is **no APM, no slow-query log shipping, no custom DB metrics** in the repo. Sentry covers app errors, not DB performance.

---

# Security

**56. How are passwords stored?** Not by the app — Supabase Auth owns credential storage (bcrypt-based, industry standard). The app never sees raw passwords. **One open item:** Supabase's "leaked password protection" (HaveIBeenPwned check) is **disabled** and flagged for the owner to toggle (Appendix I/J advisors).

**57. Is MFA supported?** Yes — TOTP via Supabase Auth. Admins enrol at `/account/security`; `adminMfaRedirect()` enforces an aal2 step-up on `/admin` when `ENFORCE_ADMIN_MFA=true` (now active per Appendix N env table). It is **fail-open** by design (never locks out un-enrolled admins). Not enforced for regular customers.

**58. What OWASP risks were considered?** Evidence across the code: A01 Broken Access Control (RLS + middleware + server-action re-checks), A02 Crypto (HTTPS/HSTS, timing-safe token compare), A03 Injection (parameterized PostgREST/RPC, Zod), A04 Insecure Design (idempotent payments, server-side re-pricing), A05 Misconfig (strict CSP/headers, env validation), A07 Auth failures (Supabase + MFA), A08 Integrity (webhook token + dedup). `eslint-plugin-security` runs in lint. No formal OWASP ASVS checklist doc, but the controls are present.

**59. How is XSS prevented?** React's default output escaping (no `dangerouslySetInnerHTML` in user-content paths — the CMS `HighlightText` parses `*asterisk*` runs into elements, not raw HTML), strict **Content-Security-Policy** in `next.config.js` (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`), and `X-Content-Type-Options: nosniff`. (CSP does allow `'unsafe-inline'`/`'unsafe-eval'` for scripts to accommodate analytics — a hardening opportunity.)

**60. How is CSRF prevented?** `SameSite=Lax` cookies (sponsor + Supabase session), `form-action 'self'` + `frame-ancestors 'none'` in CSP, and state-changing APIs require an authenticated Supabase session (cookie + bearer). Server actions are same-origin POST-only. No separate CSRF token, relying on SameSite + same-origin — standard for this stack.

**61. How is SQL injection prevented?** No string-concatenated SQL in app code — all DB access is via Supabase PostgREST query builder (parameterized) or typed RPC calls. Inputs are Zod-validated first. SECURITY DEFINER functions have `search_path` pinned (migration 033) to prevent search-path hijacking.

**62. How are file uploads secured?** Catalog image uploads go through `src/lib/catalog/image-pipeline.ts` with an 8 MB cap (`MAX_FILE_BYTES`, mirrored by `serverActions.bodySizeLimit: '10mb'`), processed by `sharp`, and stored in a Supabase Storage bucket. Uploads are admin-only (RLS + `requireAdmin`). **Open advisor:** the public catalog storage bucket "allows listing" — flagged for an audit before tightening (Appendix J).

**63. How are API keys protected?** Server-only env (`getServerEnv()` throws if accessed in browser); service-role key isolated to one module; secrets never in NEXT_PUBLIC; gitignored `.env.local`; pre-commit + CI secret scanning (custom script + TruffleHog). PayHero webhook secret is an opaque URL token compared **timing-safely** (`verifyWebhookToken`).

**64. What security testing was performed?** Static: `eslint-plugin-security`, secret scanners, **Supabase security advisors** (a documented sweep landed migration 033). Unit tests cover the security-relevant pure logic (rate-limit, webhook idempotency, order masking, fee math). **Gap:** no penetration test, no DAST, no dependency-audit gate in CI (npm `overrides` pin a few transitive deps but there's no `npm audit` step).

**65. What happens if a user attempts privilege escalation?** Three independent stops: middleware redirects non-admins off `/admin` (`/?reason=forbidden`); server actions throw `AuthError('FORBIDDEN')`; and RLS rejects the query at the database even if the first two were bypassed. Role grants are superadmin-only (`user_roles_super` policy). The `audit_log` INSERT policy was tightened so a client can't forge `actor_id` (migration 033). Four owner/admin accounts are guarded against deactivation in code (Appendix N).

---

# SEO

**66. SEO strategy?** Server-rendered HTML, per-route metadata, a dynamic sitemap, scoped robots rules, PDP structured data, canonical URLs, and the 301 redirect map preserving old `/distributors/*` invite links. Documented as brief §11 (sitemap.ts/robots.ts headers).

**67. How are metadata & Open Graph tags managed?** Root `metadata` + `viewport` in `src/app/layout.tsx` (title template `%s | Loveli Luxury Scents`, description, keywords, OG, Twitter `summary_large_image`, `metadataBase`, `locale en_KE`), with per-page overrides and dynamic OG image generation for invite cards (`r/[code]/opengraph-image.tsx`).

**68. What schema markup has been implemented?** PDP (`/p/[slug]`) emits **`Product` + `BreadcrumbList` JSON-LD** (offers populate when a priced active variant exists). That's the only JSON-LD in the app. **Gap:** no `Organization`/`WebSite`/`SearchAction` schema on the homepage and no `Review`/`AggregateRating` schema despite having review data.

**69. How are redirects handled?** Permanent **301s** in `next.config.js` `redirects()`: `/distributors/* → /partners/*`, `/account/distributor/* → /account/partner/*`, `/api/distributor-signup/* → /api/partner-signup/*`, `/boss-scents → /partners`, `/account/partner/downline → /network`. These preserve externally-shared invite links after the terminology rename.

**70. What keyword research informed content?** Lightweight — `keywords: ['perfume','luxury fragrance','eau de parfum','Kenya','Nairobi']` in metadata and locale `en_KE` signal the geo/category intent. **No documented keyword research** (search-volume analysis, competitor gap study). Copy is brand-brief-driven, not SEO-keyword-driven.

**71. How is crawlability ensured?** `robots.ts` allows `/`, disallows private/transactional/machine areas (`/admin`, `/account`, `/api`, `/checkout`, `/cart`, `/auth`, `/post-login`), and points to the sitemap. `sitemap.ts` lists static routes + every active product/bundle slug, revalidated hourly, with try/catch fallback so a DB hiccup degrades to static routes rather than 500-ing the sitemap.

**72. Core Web Vitals status?** **CLS 0** (great), **LCP 2.8s** (needs <2.5s for "good"), **TBT 30–100ms / good INP proxy**. Net: passes CLS, borderline-fails LCP on the lab mobile profile. No field/RUM (CrUX) data collected.

**73. How are canonical URLs managed?** PDPs set `alternates.canonical` (Appendix A); `metadataBase` resolves relative URLs to absolute. **Gap:** canonicals are not systematically set on every route (e.g. paginated/filtered `/shop`), only where added explicitly.

---

# Infrastructure & DevOps

**74. Where is the application hosted?** **Vercel** (app + CDN + cron) — production at `https://loveli-luxury.vercel.app`. Data/auth/storage on **Supabase** ("Loveli Luxury International" project). Plus Upstash (Redis), Resend (email), Sentry (errors), PayHero (payments). All managed SaaS.

**75. Deployment workflow?** **Manual.** Per `README.md`/PROJECT-BRIEF: edit → `npm run typecheck && npm test && npm run build` → `vercel deploy --prod --yes` from `loveli-luxury/`. **Push-to-main does not auto-deploy.** Deploys are run by the developer.

**76. Is CI/CD implemented?** A real CI pipeline is **defined** (`.github/workflows/ci.yml`: secret-scan + TruffleHog → lint+typecheck → test:coverage → build, with concurrency cancellation). **But it is effectively dormant** — the git remote `github.com/theeashish/loveli-luxury.git` is far behind: last commit is the Phase-4a era and there are **174 uncommitted files** in the working tree, so the entire May transformation has never been pushed and CI has not run against current code. There is **no CD** (deploys are manual). *This is the biggest operational gap.*

**77. What rollback procedures exist?** Payments: documented env-var rollback to sandbox + redeploy (`docs/go-live-mpesa.md` §7). App: Vercel keeps prior deployments (instant promote/rollback in the dashboard). **But** because current code is uncommitted, there is no git-based "revert to a known-good commit" path for the source — only Vercel's deployment history.

**78. How is uptime monitored?** **Not in the repo.** No uptime monitor (Pingdom/UptimeRobot/Checkly) is configured. Vercel provides basic availability; Sentry alerts on errors, not downtime. **Gap.**

**79. What logging solution is used?** **Sentry** (client + server + edge, via `@sentry/nextjs` + `instrumentation.ts`) for errors/traces, Vercel's built-in function logs (`console.warn`/`console.error` from routes), and an application **`audit_log`** table for business events. No structured/centralized log aggregation (e.g. Logflare/Datadog) beyond these.

**80. What alerting system is configured?** Sentry issue alerts (when DSN is set, now active). No PagerDuty/Opsgenie, no business-metric alerts (e.g. "payments failing"), no uptime alerts. Alerting is error-only.

**81. What happens if traffic increases 100x overnight?** The serverless front end (Vercel functions + CDN) scales horizontally and would mostly cope for cached/static reads. The **first thing to break is the database tier**: Supabase Postgres connection limits / compute on the current plan, since every checkout/auth call hits Postgres and middleware calls `auth.getUser()` on nearly every request. Upstash rate-limits would throttle abusive bursts but also legitimate spikes. No load test has been run, so 100x is unvalidated and the realistic answer is "DB-bound, would need a plan bump + connection pooling (Supavisor) tuning."

**82. Scaling strategy?** Implicit/vertical: lean on managed autoscaling (Vercel) + Supabase plan upgrades + edge caching + the denormalized `gsv_snapshots` to avoid tree walks. There is **no documented horizontal-scale plan**, read-replica strategy, or capacity model.

**83. Expected monthly infrastructure cost?** Not documented. Order-of-magnitude estimate at low/launch scale: Vercel Pro ~$20, Supabase Pro ~$25, Upstash ~$0–10, Resend ~$0–20, Sentry ~$0–26, plus PayHero per-transaction fees → roughly **$60–100/month** baseline, rising with traffic/transaction volume. (Estimate, not a repo figure.)

---

# Quality Assurance

**84. Testing strategy?** Unit tests (Vitest) over the **pure business logic** in `src/lib/**` — money/fee math, commission & salary calculators, cart logic/selectors, catalog mappers/schemas/slug, PayHero idempotency/retry, rate-limit, order masking, receipt. Plus engineer verification gates (typecheck + build + live HTTP/HTML probes) on every deploy. No integration or E2E layer.

**85. What percentage of the codebase is tested?** **Verified:** 25 test files, **355 tests, all passing** (ran `npm test`: 2.43s). Coverage is configured to `include: ['src/lib/**/*.ts']` and **excludes** supabase, env, queries, mutations, auth, cart/store — so the measured **~98% line coverage is over just 17 small pure-logic files** (194/198 lines), gated at 80% thresholds. As a fraction of the whole ~33k-line app (65 pages, 12 API routes, all components, 20 server-action files), **automated coverage is a thin slice** — the critical *money* logic is well covered; the React/API/DB layers are **0%**.

**86. What end-to-end tests exist?** **None.** No Playwright/Cypress, no `*.spec.ts`, no integration suite (the vitest config references a `tests/integration/` dir that doesn't exist). The full checkout→webhook→ledger path is verified manually/by live probe, not by an automated E2E test.

**87. Manual QA process?** After each change: `tsc` clean → 355 tests → `next build` green → deploy → **live verification** (HTTP status + grepping served HTML for expected content, RPC probes against the live DB). Documented exhaustively in masterplan "Verification" blocks. It's disciplined but manual.

**88. How are bugs tracked?** In the **docs**, not an issue tracker — `docs/delivery-punchlist-2026-05.md` (P0–P3 with ownership tags) and the masterplan appendices serve as the bug/work log. No GitHub Issues/Jira/Linear. Sentry captures runtime errors.

**89. What unresolved bugs currently exist?** No known *functional* bugs in shipped code (tests green, build clean). Open *items* are mostly config/content/external: no real PayHero webhook has reached the endpoint in production yet (`webhook_deliveries` = 0; all paid orders were admin-reconciled — Appendix G/runbook), Supabase advisors open (leaked-password off, citext in public, public bucket listing), stale `.env.example`/punchlist, Flutterwave dead refs.

**90. Most serious bug found during development?** The **`payment_attempts` column drift** (Appendix G): an earlier hand-applied `CREATE TABLE` left the live table with 7 of 10 columns; migration 019's `IF NOT EXISTS` silently no-op'd; every dispatcher insert failed with "column does not exist" but the best-effort wrapper never inspected the error — so the **entire STK audit trail was silently empty after ~15 orders**. Fixed by migration 030 + making the dispatcher surface insert errors + a regression test. Runner-up: the RLS infinite-recursion on `distributors` (Appendix J).

---

# Maintainability

**91. Can a new developer understand this project within a week?** **Yes, unusually so.** The docs are excellent: `PROJECT-BRIEF.md` (owner snapshot), `transformation-masterplan-2026-05.md` (canonical state with timestamped Appendices A–Q documenting every change + rationale), `delivery-punchlist`, `go-live-mpesa`, `MIGRATION_NOTES`. Strict types + domain-organized `lib/` + heavily commented routes make it tractable. The main friction: doc drift (some docs claim React Query/Flutterwave/older test counts) and uncommitted code (no git history to learn from — the masterplan *is* the history).

**92. What documentation exists?** README (quick-start), 11 docs in `docs/` (brief, masterplan, 4 phase plans, preflight ×2, go-live runbook, punchlist, photography brief, delivery), MIGRATION_NOTES, PAYHERO_CUTOVER, inline file-header doc comments throughout `lib/` and routes, and `.env.example`. Documentation is a genuine strength.

**93. Which modules are most tightly coupled?** The **payment→provisioning→ledger chain** (`apply-payment-success.ts` orchestrates `mark_order_paid` → `provision_distributor` → `write_commission_ledger` → receipt → audit, called by 5 entrypoints) — necessarily coupled to the orders/distributors/commission schema and PayHero types. And the **comp engine** (`config_ranks`/`commission_ledger`/RPCs) where the SQL functions and the dashboard read the same versioned config columns.

**94. What refactoring is planned?** Documented in `MIGRATION_NOTES.md` (Phase 2 proposal): rename `monthly_salaries → retention_bonus_grants`, `gsv_snapshots → revenue_snapshots`, `is_starter_package → is_onboarding_kit`, and the high-risk `distributors → partners` table + `user_roles.role` enum renames (deferred, dual-write + flag + staged). *Caveat:* parts of MIGRATION_NOTES (the 8→4 tier collapse) were **superseded** — the team stayed on the 5-rank v1 model and removed the v2 scaffolding (Appendix C/K), so this doc is partly stale. Active cleanup: drop `as unknown as` casts now that types are regenerated.

**95. What would break first if the team doubled the feature set?** (a) **The test net** — with routes/components/DB at 0% automated coverage and no E2E, regressions would land silently; (b) **the manual deploy/no-CI workflow** — fine for one dev, fails with parallel contributors and uncommitted state; (c) the **checkout route** (already ~630 lines of branching) and the **comp engine** would accrete complexity fastest.

**96. Which areas require the most maintenance?** The **PayHero/payments integration** (external provider quirks, sandbox→live, reconciliation paths), the **compensation engine** (config changes, rank/PV math, monthly close), and **content** (catalog + CMS sections + homepage imagery). These are where the appendices show the most churn.

**97. What coding standards are enforced?** TypeScript strict, ESLint (`next/core-web-vitals` + security plugin), Husky pre-commit (`eslint --fix` + secret scan via lint-staged), money-in-minor-units convention, versioned-config convention, copy rules (no em-dashes / banned words), file-header doc comments. CI adds typecheck + tests + build + TruffleHog (when it runs).

---

# Commercial Readiness

**98. Would you confidently launch to 100,000 users tomorrow?** **No.** The architecture is sound, but blocking realities: (1) payments are on **M-Pesa sandbox** — no real money can be taken until Safaricom Daraja Go-Live clears; (2) catalog is **~2 test products**; (3) **no real PayHero webhook has ever been processed** in prod (all paid orders were admin-reconciled); (4) performance is **below the ≥90 / <2.5s LCP target** on the actual 4G audience; (5) **0% automated coverage** on routes/UI/DB and no E2E; (6) operationally fragile — **uncommitted code, dormant CI, no uptime monitoring, no tested DR**; (7) the DB tier is the unproven scaling ceiling at 100x. It could likely serve a *small* real launch within ~1–2 weeks of Daraja approval (per the punch-list), but not 100k tomorrow.

**99. Top five reasons it could fail after launch?**
1. **Payment misconfiguration** — wrong callback URL/token = customer pays but order stays `pending` (the runbook calls this out as the #1 "M-Pesa is broken" cause); with no webhook ever exercised in prod, this is untested in the wild.
2. **Database/scale ceiling** — Supabase plan connection/compute limits under load (middleware hits `auth.getUser()` per request), no load test, no read-replica plan.
3. **Operational fragility** — uncommitted source + manual deploys + no CI gate + no uptime/health alerting means a bad deploy or outage is slow to catch and hard to roll back at the source level.
4. **Performance on 4G** — sub-target LCP + heavy/off-brand hero imagery → bounce on the exact mobile network the audience uses.
5. **Trust/content + compliance** — placeholder reviews, no founder video, and an **MLM comp plan that hasn't had the recommended legal review** — both conversion and regulatory risk.

**100. If given two more weeks, what would you fix before release?**
1. **Commit everything to git + turn CI on** (push the working tree; let the defined pipeline actually gate deploys) — removes the single largest operational risk.
2. **Drive one real end-to-end M-Pesa transaction** through the registered callback and confirm a `webhook_deliveries` row + ledger write (closes the untested-in-prod payment path), after Daraja Go-Live is initiated.
3. **Close the performance gap** — replace the hero images per the render brief, re-run Lighthouse, get LCP <2.5s / Perf ≥90.
4. **Add a thin E2E smoke suite** (Playwright: browse→cart→checkout-init, login, partner-signup guard) + an uptime monitor + a basic health/alerting hook.
5. **Housekeeping that reduces real risk:** fix `.env.example` (PayHero/Upstash/MFA, drop Flutterwave), remove Flutterwave dead refs, clear the open Supabase advisors (enable leaked-password protection, tighten the storage bucket), seed a real starter catalog, and get the **legal comp-plan review** moving.

---

## Top 10 fixes, prioritized

| # | Fix | Why it matters | Effort |
|---|---|---|---|
| 1 | Commit working tree + activate CI | 174 files unversioned; CI defined but never runs | S |
| 2 | Real M-Pesa webhook smoke test (post Daraja) | Payment confirmation path never exercised in prod | S (gated by external) |
| 3 | Add uptime + health monitoring/alerting | No way to know if the site is down | S |
| 4 | LCP/perf pass (hero imagery + re-Lighthouse) | Below target on the 4G target audience | M |
| 5 | Thin E2E smoke suite | Routes/UI/DB have 0% automated coverage | M |
| 6 | Document + test backup/DR restore | DR is undefined; no tested restore | M |
| 7 | Seed real product catalog | ~2 test products today | M (owner) |
| 8 | Clear Supabase security advisors | leaked-password off, public bucket listing, citext | S |
| 9 | Kill stale refs (.env.example, Flutterwave, punchlist) | Actively misleads maintainers | S |
| 10 | Legal review of MLM comp plan | Regulatory exposure flagged in the brief | M (external) |

*Strengths worth preserving: RLS-on-every-table, money-in-minor-units, idempotent/timing-safe payment webhook, versioned config, strict CSP/HSTS, and the best in-repo documentation I've seen on a project this size.*
