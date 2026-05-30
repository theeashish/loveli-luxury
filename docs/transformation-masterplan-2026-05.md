# Loveli Luxury — Transformation Master Plan

**Status reference, not a fresh kickoff.** This document is the umbrella over the §1–§13 luxury transformation. It consolidates the [brand brief](#appendix-source-documents), the four phase plans, the Phase 0 preflight, and the **current shipped state of the code** into one canonical reference. Where a phase plan already carries execution detail, this doc links rather than duplicates.

- **Last updated:** 2026-05-21
- **Production:** https://loveli-luxury.vercel.app
- **Stack:** Next.js 14.2 (App Router) · TypeScript strict · Supabase/Postgres · PayHero (M-Pesa STK + B2C) · Vercel · Sentry · Resend · 22 test suites / 359 tests
- **Deploy reality:** **No git repo exists** in this workspace. The workflow is edit → `tsc`/`vitest`/`next build` → `vercel deploy --prod --yes` from `loveli-luxury/`. There is no commit/push step. The monthly-close cron is registered in `vercel.json` (`0 3 1 * *`).

---

## 0. Current position (read this first)

This is **not** a greenfield build. The platform is mature and the transformation is mid-execution:

| Phase | Scope | State |
|---|---|---|
| **0 — Audit** | Full preflight inventory | ✅ Shipped (`docs/preflight-2026-05.md`) |
| **1 — Terminology + slug + migration proposal** | Customer-facing copy, `/distributors→/partners`, `MIGRATION_NOTES.md` | ✅ **Complete + deployed 2026-05-21** (see §A) |
| **2a — Additive 4-tier schema** | `partner_tiers`, `partner_qualifications`, admin tier surfaces | ✅ Shipped (migrations `023`/`024`) |
| **2b — Engine v2 + cutover** | Tier-based comp engine, quarterly retention bonuses | ⏳ Planned (`docs/phase2-plan-2026-05.md`), flag-gated, **not live** |
| **2c — Renames + fraud rules** | `monthly_salaries→retention_bonus_grants`, KYC/velocity/self-referral | ⏳ Planned |
| **2d — `distributors`→`partners` table rename** | RLS/FK/RPC ripple | ⏳ Deferred (own session) |
| **4a — Trust infrastructure** | WhatsApp concierge, policies, `/track`, `/story` | ✅ Shipped |
| **4b — Discovery/retention** | Wishlist, recently-viewed | 🟡 Partial (wishlist ✅; abandonment/email/SMS flows ⏳) |
| **Home restructure** | Trust strip, customer proof, philosophy, social-proof scaffold, softened partner teaser | ✅ **Shipped + deployed 2026-05-21** (see §A) |
| **4c/4d, 5** | Sample kits, quiz polish, loyalty, perf | ⏳ Not started |

**The central risk is no longer "starting" — it is finishing the half-states** (e.g., a renamed route behind legacy copy reads as *more* suspicious, not less) and pacing the high-risk compensation work (Phase 2b) safely.

---

## The core strategic resolution: luxury ⇄ MLM

The single hardest problem. The resolution is **architectural separation with a shared aesthetic**, enforced in IA and code — not a louder partner section. Six operating rules:

1. **Product is the only funnel entrance; the partner program is a door, not a hallway.** A retail visitor can complete browse → PDP → cart → checkout → confirmation **without the word "partner" appearing unless they seek it.** The program lives at exactly one discreet homepage teaser (#8) and one page (`/partners`). *Enforced:* the hero's "Become a distributor" CTA was removed (2026-05-21).
2. **Earn-by-selling, proven in the UI.** Dashboards foreground personal retail revenue + retention; network/override earnings are secondary. The hard comp rules (no payout without a verified paid order; no recruitment-only qualification; sales-tied retention) are surfaced as a *visible trust feature* on `/partners` ("The rules the program runs on"). Transparency about how money is made is the antidote to pyramid optics.
3. **Aspiration via status goods, never income claims.** No percentages, earnings screenshots, or "financial freedom." Partner aspiration = regional rights, limited-edition allocation, event access, brand-building. *Enforced:* the homepage partner teaser's "10–20% commission" stat was removed (2026-05-21).
4. **Vocabulary is perception engineering; half-done is worse than not-started.** Kill-list now complete in customer-facing surfaces: `distributor→partner`, `downline→network`, `boss-scents→partners`, `Independent Business Owner→Partner Program`, `Boss Scents International→Loveli Luxury`. Internal code identifiers and admin screens intentionally retain legacy terms until Phase 2.
5. **One visual system, two emotional registers.** Customer register: scent, mood, presence, trust. Partner register: craft, curation, legacy. Same restrained palette — the partner track is never a gold-drenched stat casino.
6. **Trust scaffolding is the bridge.** Real authenticity/refund/delivery policies, order tracking, founder story, verified reviews, M-Pesa, WhatsApp concierge are what let a luxury brand carry a partner program without looking scammy. Most exist (Phase 4a); they are now *placed* on the homepage (trust strip #2, proof #6) where a skeptical first-time visitor judges in 5 seconds.

---

## §1 — Platform audit (current state)

**Strengths (keep, don't "improve"):**
- Design system is genuinely on-brand and restrained — warm near-black, champagne gold, oxblood, editorial serif (Cormorant) + sans, 4–5% radial accents (`src/app/globals.css`). Do **not** add gradients/gold/glassmorphism.
- Compensation engine is mature: closure-tree to depth 14, commission ledger L1–L7 with compression, clawbacks, monthly close, PV — all RPC-enforced with RLS. 359 passing tests.
- Payments are real: PayHero STK push + B2C, idempotent webhooks, reconcile path, expired-order handling.

**Resolved this session (were the live weaknesses):**
- 🔴 Hero recruitment CTA on screen one → removed.
- 🔴 Half-finished copy refactor (auth pages branded "Boss Scents International", OG invite card "Independent Business Owner Program", FAQ pyramid data-dump) → fixed.
- 🟠 Homepage missing trust strip / customer proof / social proof → trust strip + customer proof added; social proof scaffolded (renders when real content supplied).
- 🟢 Dead CSS (custom-cursor, Lenis for an uninstalled lib) → removed.

**Remaining weaknesses:**
- 🟠 **Performance** below target: Home 84 / PDP 86 (target ≥90), LCP 2.8s (target <2.5s), PDP SEO 91. The hero ships 5 full-res bottle images crossfading client-side — a bandwidth/LCP drag on Kenyan 4G. → Phase 5.
- 🟠 **Content gaps the owner must fill:** real verified reviews (placeholders flagged in `CustomerProof.tsx`), press/creator features (`SocialProof.tsx` renders nothing until supplied), founder story copy/portrait, customer **video** reviews (brand brief: non-negotiable for fragrance).
- 🟠 **Receipt email** is stubbed (`src/lib/email/affiliate-upgrade.ts`); Resend not wired for transactional sends.

---

## §2 — UX / UI

- **Homepage architecture (now live):** Hero → Trust strip → Collection → Find-your-scent quiz → Story → brand marquee → Customer proof → Fragrance philosophy → Partner teaser → Social proof (when populated) → FAQ → Footer. Matches the brand-brief section order.
- **Navigation:** global header pill relabeled "Boss Scents" → "Partners" → `/partners`; footer "Partner program" link repointed. **Open IA decision:** the always-on header partner pill plus the signed-in-only `AffiliateUpgradeLink` is mild redundancy — consider demoting the pill to keep the program a *discreet* door (rule #1).
- **Component hierarchy / spacing / type:** whitespace-led, editorial serif display, premium sans body, `.text-eyebrow` motif. Consistent across new sections.
- **CTA system:** one primary CTA per section; hero is now single-CTA. Partner CTA is editorial (no rate stat).
- **Interaction / animation:** restrained. The brand marquee is the only continuous motion — candidate for removal under the brief's "kill busy animations" if it ever competes with content.

---

## §3 — Brand positioning

Canonical and locked in the brand brief. Summary: *a premium African fragrance commerce ecosystem with a discreet partner program* — **not** an MLM with a store on top. Tagline candidate: *"The home of modern African luxury fragrance culture."* Four customer-facing tiers (Concierge Partner → Brand Associate → Regional Curator → Prestige Partner). Vocabulary table and emotional/aspirational psychology: see brand brief. Execution now matches the doc (vocabulary leaks closed).

---

## §4 — Ecommerce architecture

- **Live:** catalog (products/variants/bundles), cart (Zustand), retail checkout with PayHero STK, wishlist, recently-viewed, order tracking, bundle detail. PDP carries fragrance-meta scaffolding.
- **PDP completeness (brand-brief mandatory fields):** surface scent family, top/middle/base notes, longevity, projection, best occasion, seasonality, gender profile, "inspired by", delivery timeline, authenticity guarantee. Audit `src/lib/catalog/fragrance-meta.ts` vs the brief's required list and fill gaps.
- **Gaps / roadmap:** sample/discovery kits (sample-set SKU), subscriptions, customer loyalty (verified-orders-only points), abandoned-cart recovery, "smells similar to", mood tags, customer **video** reviews, AI-recommendation slot. → Phase 4c/4d.
- **Upsell/bundles:** bundle system exists; add cross-sell on PDP + cart and a discovery-kit → full-bottle upgrade path.

---

## §5 — MLM / partner architecture

- **Live:** invite-only signup (sponsor required — non-negotiable business rule), closure-tree network, commission ledger, monthly close, clawbacks, partner dashboard (`/account/partner/*`) with tier display, network tree (now shows **tier** names, not raw ranks), share/QR, payout MSISDN + KYC.
- **Tier model:** 4 customer-facing tiers bridged from 8 internal ranks via `src/lib/partners/tiers.ts` (display layer). Additive `partner_tiers` schema shipped (Phase 2a).
- **Not yet live (Phase 2b/2c):** the §6.1 qualification engine (rolling-90-day verified sales, retention score, content output), the v2 tier-based commission engine (flag-gated, side-by-side dry-run mandated), quarterly retention-bonus admin batch (replaces "lifetime salary"), fraud rules (KYC payout gate, velocity, self-referral). Detailed in `docs/phase2-plan-2026-05.md` — **highest-risk phase; one sub-phase per release, bake one monthly close between each.**
- **Presentation:** prestige via tiers/access/allocation, never recruitment chaos. `/partners` already frames "a partner program, not a payout pyramid."

---

## §6 — Technical architecture

- **Frontend:** Next 14 App Router, RSC-first, Tailwind + CSS-var HSL tokens, Zustand for cart, React Query, `next/image` (AVIF/WebP configured in `next.config.js`).
- **Backend/data:** Supabase Postgres, RLS on every table, `has_role()` policy helper, money in minor units, RPC-enforced money paths, idempotent PayHero webhooks (`webhook_deliveries` dedup).
- **Security:** strict CSP + HSTS + frame-deny headers in `next.config.js`; service-role client server-only; Zod input validation.
- **Redirects:** `next.config.js` `redirects()` covers `/distributors/*→/partners/*`, `/account/distributor/*→/account/partner/*`, `/api/distributor-signup/*→/api/partner-signup/*`, `/boss-scents→/partners`, `/account/partner/downline→/account/partner/network` (all 308 permanent, verified live).
- **Integrations to finish:** Resend transactional email (receipts, signup, payout) is stubbed; analytics pixels (GA4/Meta/TikTok) are env-gated — verify wired; Sentry DSN optional.
- **Scalability/perf:** see §8 / §1. Closure-table depth 14 supports compressed walks.

---

## §7 — Conversion optimization

**Weakest historical area; partly addressed this session.**
- **Homepage flow:** trust in 5 seconds (trust strip), product early (collection + quiz), proof mid-page (customer reviews), single hero CTA. Done.
- **Still to build:** abandoned-cart recovery (email + WhatsApp), post-purchase email flow, win-back, social-proof population, "X orders delivered" counter (brand brief), urgency/scarcity used *sparingly* (luxury restraint — no fake countdowns), structured-data for PDP (SEO/rich results).
- **Funnels:** keep customer and partner acquisition funnels separate (rule #1). Partner acquisition is editorial + invite-driven, not a homepage blast.

---

## §8 — Mobile-first (Kenya)

- **Done:** M-Pesa STK checkout, WhatsApp concierge (floating + footer + context-aware message — matcher fixed to `/account/partner`), responsive layouts, mobile nav drawer.
- **Priority gap — performance on 4G:** hero's 5-image client crossfade is the prime suspect for LCP 2.8s. Serve a single responsive AVIF LCP image with `priority` + preload; lazy-load below-the-fold; audit third-party scripts. Target LCP <2.5s, Performance ≥90.
- **Social commerce:** invite OG card now brand-correct; shareable `/r/[code]` links + 308 redirects intact; add share affordances on PDP.

---

## §9 — Visual direction

- **Palette/type:** locked and on-brand (see §1). Warm neutrals, charcoal, champagne gold (restraint), oxblood accent; Cormorant display + sans body.
- **Photography:** the product is the hero — cinematic, shadowed, mood-lit; 4:5 mobile / 3:4 desktop; never raw catalog PNGs on white. Current bottle renders use `object-contain` with ambient shadow — good; ensure all catalog imagery follows the mood-lit standard.
- **Motion:** subtle crossfades only; avoid busy animation. Glassmorphism/gold/gradient stacks remain on the "kill" list.

---

## §10 — Roadmap (forward, in order)

1. ✅ **Finish Phase 1** (copy/slug/redirects/dead-CSS) — *done + deployed.*
2. ✅ **Homepage restructure** (trust/proof/philosophy, softened teaser) — *done + deployed.*
3. **Content pass (owner-dependent):** real verified reviews, press/creator features, founder story + portrait, video reviews. Unblocks the proof sections' actual trust value.
4. **Phase 5 performance — started 2026-05-21:** hero now defer-mounts non-LCP images (initial paint ships 1 bottle image, not 5); PDP carries `Product` + `BreadcrumbList` JSON-LD + canonical + OG image. **Remaining:** re-run Lighthouse to confirm ≥90 / LCP <2.5s; ensure every live product carries price + description + image so its `Product` schema emits full `offers` (seed products like `rose-noir` currently lack a priced variant, so offers is correctly omitted).
5. **Phase 4c/4d:** sample/discovery kits, fragrance-quiz polish, loyalty (verified-orders-only), abandonment + email/SMS flows (wire Resend first).
6. **Phase 2b (engine core + staging applied 2026-05-21, flag-off) → 2c → (defer 2d):** the v2 tier engine (`engine-v2-tier.ts`, pure, 9 tests), staging migration `027` (applied to prod), and `COMPENSATION_ENGINE` flag (default `v1_rank`) are shipped but **inert** (not wired into the payment path). **Blocking prerequisite found via dry-run: every distributor has `current_tier_id = NULL`**, so v2 would pay zero by the §6.2 no-tier rule. Before any cutover: assign tiers to active partners, then wire the `'both'` dry-run write, accumulate real orders, compare v1-vs-v2, then flip. Then 2c (renames + fraud), defer 2d. **Never ship the comp engine in one shot.**

---

## Appendix A — Shipped 2026-05-21 (this session)

**Phase 1 finish:** removed hero "Become a distributor" CTA; rewrote homepage FAQ (stripped 8-rank/lifetime-salary/stock-maintenance pyramid copy); `/boss-scents`→`/partners` (page moved, 5 inbound links + header/mobile pills relabeled, 308 redirect); `/account/partner/downline`→`/account/partner/network` (network tree now renders tier names, not raw ranks); de-branded auth flow (login/signup/forgot/reset: "Boss Scents International"→"Loveli Luxury", "Become an affiliate"→"Join the partner program"); OG invite card "Independent Business Owner Program"→"Partner Program" + domain `theperfumeworld.co.ke`→`loveli-luxury.vercel.app` (**confirm preferred custom domain**); `HeaderAuth` badge AFFILIATE→PARTNER; concierge matcher `/account/distributor`→`/account/partner`; removed dead Lenis/custom-cursor CSS; extended `next.config.js` redirects.

**Homepage restructure:** new `TrustStrip`, `FragrancePhilosophy`, `CustomerProof` (flagged placeholder reviews), `SocialProof` (renders only with real press); reordered `app/(public)/page.tsx` to brand-brief structure; softened `DistributorCTA` (removed commission-rate stat).

**Performance slice (started):** `Hero` defer-mounts non-LCP images via a post-hydration `mounted` flag (SSR/first paint ships only the priority LCP image); `/p/[slug]` emits `Product` + `BreadcrumbList` JSON-LD (offers populate when a priced active variant exists) plus `alternates.canonical` and OG image.

**Social-proof CMS (admin-editable, migration 026 — APPLIED to prod 2026-05-21):** new `homepage_reviews` + `press_features` tables (RLS public-read-published / admin-all), data layer `src/lib/home/social-proof.ts`, admin CRUD at `/admin/content/social-proof` (+ sidebar "Content" group). `CustomerProof`/`SocialProof` are DB-backed; 3 reviews seeded and live; press renders only when published, so no fabricated content ships. CMS is active. Product catalog (price/description/image) is already admin-editable at `/admin/catalog/products`; only the homepage scent metadata in `fragrance-meta.ts` remains a hardcoded constant.

**Phase 2b core (engine built + staging APPLIED, flag-off — migration 027):** pure tier engine `src/lib/payments/engine-v2-tier.ts` (direct + override commissions, §6.2 hard rules, 9 table-driven tests), staging migration `027_engine_v2_staging.sql` (`commission_ledger.compensation_engine`/`tier_at_time_id` + `commission_ledger_v2_preview`), and `COMPENSATION_ENGINE` env flag (default `v1_rank`). **Inert** — not wired into the payment path. Applied to prod 2026-05-21 via the Supabase connector; 023/2a confirmed live. **Dry-run finding (blocking for cutover):** every distributor has `current_tier_id = NULL` (and `current_rank_id = NULL`), so v2 pays zero today by the §6.2 no-tier rule. Prerequisite before wiring the `'both'` write or flipping: assign tiers to active partners. Then accumulate real orders in `'both'` mode, compare v1-vs-v2, then cut over.

**Privacy redesign of `/partners` (2026-05-21):** the public page is now **invitation + aspiration only** — tier *names* as a career path (no rates), philosophy, integrity rules, a "Built by partners" stories section, and how-to-join. **All pricing, retail margins, earnings tables, and exact commission rates moved to the partner-only `/account/partner/earnings`** (gated by the partner layout; new "Earnings" nav tab). Owner privacy rule: the numbers are partner-only — join to see them. Verified live: sensitive figures absent from `/partners`, present only behind login.

**Verification:** `tsc` clean · 368/368 tests (23 suites) · `next build` green · deployed after each slice (Phase 1 finish, homepage, perf, social-proof CMS, engine core) · live: 308 redirects, homepage HTTP 200 (reviews via fallback) + all legacy leaks absent, PDP HTTP 200 with valid JSON-LD, `/admin/content/social-proof` gated (307).

## Appendix B: Shipped 2026-05-22 (this session)

**PDP fragrance detail (DB-backed + admin).** Closed the §4/§6 gap where per-product fragrance metadata had no source (`fragrance-meta.ts` is home-only marketing copy keyed to 9 slugs that do not match the real catalog). New additive table `product_fragrance_meta` (migration `028`, 1:1 with `products`, RLS public-read / admin-all) carries top/heart/base notes, longevity, projection, climate note, occasions, story, scent family, inspired-by. Wired through `ProductDto.fragranceMeta` (mapper + `getProductBySlug`/`getProductById`, graceful-null on a missing table or row), rendered by `components/catalog/FragranceDetail.tsx` (each section hidden when empty), and admin-editable at `/admin/catalog/products/[id]` via `AdminFragranceMetaEditor` + the audited `upsertProductFragranceMeta` action (which revalidates the SSG `/p/[slug]`). New-table reads/writes use `as unknown as` casts pending the P3 `database.ts` regen.

**Verification:** `tsc` clean, 379/379 tests (27 suites), `next build` green, deployed. Live-verified: `/p/loveli-signature` (seeded sample) renders all five detail sections through the anon client (proves public-read RLS); `/p/rose-noir` (no meta row) renders cleanly with no detail block. The sample seed on `loveli-signature` is placeholder copy: replace it with real copy in the admin editor.

**Also:** Supabase MCP reconnected (the SQL relay is no longer needed); `generate_typescript_types` is now available to do the P3 regen and drop the `as unknown as` casts.

## Appendix C: Client comp plan applied (2026-05-22)

**Decision.** The client's compensation plan (unilevel L1-L5 at 20/11/6/2/1; five ranks Ambassador / Executive / Gold Director / Platinum Director / Crown President; per-rank bonus + monthly lifestyle bonus; PV-based) maps onto the LIVE v1 engine, not the inert v2 4-tier model. We configured v1 to the client's numbers and **shelved the v2 4-tier redesign** (Concierge / Brand Associate / Regional Curator / Prestige). The v1 engine already implements the model: `write_commission_ledger` caps each upline's earned level at `rank_position` (rank N earns L1..N), commission = PV x rate%, `detect_rank_up` honors `config_ranks.qualifying_months` (consecutive-month streak) for the one-time rank bonus, and `compute_monthly_salary` pays the per-rank `fixed_salary_minor` monthly (the lifestyle bonus).

**Applied (migration 029, pure config, versioned + audited, verified on sandbox):** commission_rates 20/11/6/2/1 (L6/L7=0); config_ranks positions 1-5 with directs 5/10/20/50/120, group targets KES 100k/300k/750k/2.5M/7.5M, rank bonuses KES 5k/15k/40k/120k/300k, qualifying_months 2/3/3/2/3 (ranks 6-8 retired); salary_tiers personal bottles 5/10/15/25/35 with fixed KES 0/5k/20k/100k/250k; product_variants 30ml PV350/IBO700/retail1500, 50ml PV700/IBO1400/retail2800. Dry-run confirmed (50ml per level: L1 140 / L2 77 / L3 42 / L4 14 / L5 7).

**Deferred to gated engine phases (NOT built):** (E1) Crown President "75 active customers" requirement (new field + qualification check + gsv-snapshot computation). (E2) Maintenance grace-period commission unlocking (T&C 6-7). Until E2 ships, the personal-PV maintenance gate stays at 0 (off, as before).

**Reframes the P2 punch-list:** the "comp-plan cutover" items (flip COMPENSATION_ENGINE=v2_tier, etc.) are no longer the plan. We stay on v1, configured to the client. The v2 engine/tier scaffolding (engine-v2-tier.ts, partner_tiers, COMPENSATION_ENGINE flag) is now dormant-by-decision, not a pending cutover.

**Display (done + deployed 2026-05-22).** Adopted the client's 5 rank names across every user-facing surface. `src/lib/partners/tiers.ts` rewritten to 5 ranks (1:1 with `config_ranks`; fields renamed `directRateLabel`/`overrideLabel` → `commissionLabel`/`bonusLabel`); public `/partners` shows the Five-ranks ladder (no rates); partner dashboard, `TierBadge`, and the homepage FAQ + partner teaser + account upgrade cards all use the 5 names. Stripped the stale public "10% on direct sales" line (privacy rule). `/account/partner/earnings` (partner-only) now carries the unilevel L1–L5 table + corrected pricing (30ml 700/1500, 50ml 1400/2800) + margins. The 4 brand-brief names (Concierge / Brand Associate / Regional Curator / Prestige) are retired from user-facing surfaces; the inert v2 tier engine keeps them internally. Rank 5 = **Crown President**. Verified live (`/partners` renders all 5, no old names, no rates); tsc clean, 376 tests, build green.

## Appendix D: Copy purge + M-Pesa Go-Live prep (2026-05-22)

**Copy purge (complete, deployed in 6 waves).** Removed all user-facing em dashes and banned AI-slop words (Discover, Hand-crafted, craft / craftsmanship, journey, unlock) from every rendered surface: homepage + global chrome (layout metadata, hero, footer, philosophy, story section, quiz, customer proof including the seeded DB review, trust strip, FAQ, partner teaser, fragrance taglines); `/partners`; partner portal (earnings, dashboard, the two account upgrade cards); `/story`; all three policy pages; account utilities (orders, security, share, profile, settings error toasts); checkout / signup / track; and empty-value placeholder glyphs converted to `-`. Code comments are intentionally left as-is (not user-facing). Every wave: tsc clean, 376 tests, build green, deployed. Em-dash discipline now applies to any new copy.

**M-Pesa Go-Live prep.** `docs/go-live-mpesa.md` written. Code verified config-only for the sandbox-to-production switch (grep found no hardcoded sandbox paybill / channel / URL). Owner action remaining: Daraja Go-Live approval, then set the live PayHero channel ids + auth token in Vercel and register the `?key=` callback URL.

**Pending premium-brief decisions (gate the visual overhaul).** The 2026-05-22 premium brief specifies a palette (charcoal #111111 / cream #F5F3EF / warm brown #5C4033 / muted gold #B8955A) that would override the locked 2026-05-18 brand palette, and a secondary hero "Become a Partner" CTA that contradicts the deliberate rule-#1 removal of the hero recruitment CTA. Both need explicit owner sign-off before restyling, since they reverse locked decisions.

## Appendix E: Light-theme redesign (2026-05-22, this session)

**Decision.** The owner pointed at mondedesparfum.com (light, airy, photography-led) and said it is the look they expect. We flipped the site from the dark editorial aesthetic to a LIGHT theme. This overrides the dark palette locked in the 2026-05-18 brand brief. Serif headings (Cormorant) kept; body sans (Inter). The hero "Become a Partner" CTA stays removed (discreet door).

**Shipped + deployed, in 2 stages:**
- Stage 1: `globals.css` tokens inverted to light. background cream `40 23% 95%`; foreground warm charcoal `22 14% 13%`; muted deeper cream `40 22% 90%`; muted-foreground warm gray `28 8% 38%`; primary antique gold `34 45% 42%`; accent warm brown `19 29% 28%`; border `34 16% 85%`. viewport themeColor set to `#F5F3EF`. The hardcoded dark `#0D0D0D` sections on `/partners` (hero, how-to-start, tier card headers, step cards) converted to light: white text to ink, grays to muted token, golds deepened.
- Stage 2: primary CTAs switched to CHARCOAL (`bg-[hsl(var(--foreground))]` + `text-[hsl(var(--background))]`) across the customer journey (hero, add-to-cart + VariantPicker, find-your-scent, partner CTA, cart drawer + page, "Pay with M-Pesa", checkout return, `/partners` join, account submit buttons). Gold (`--primary`) is now accent-only (eyebrows, dividers, hero progress dots, cart badge, outline buttons). Hero bottle enlarged 520 to 580.

**Convention going forward:** charcoal = primary CTA; gold (`--primary`) = accents only; warm brown (`--accent`). Light theme throughout. tsc clean, 376 tests, build green at each deploy.

**Pending (next session):** deeper whitespace + a large photography-led layout to fully match the reference. This DEPENDS on real product photography (only 2 test products exist: `rose-noir`, `loveli-signature`); tune spacing with the owner's visual review. Still open from before: the deferred comp-engine items (Crown President "active customers"; maintenance grace-period), a performance pass, and the `database.ts` types regen.

**Also this session:** "Order via WhatsApp" button added to the product page (wa.me concierge link with product context). Owner-facing project brief written at `docs/PROJECT-BRIEF.md`.

## Appendix F: Layout airiness pass + photography render brief (2026-05-27)

**Imagery finding (the real blocker for a photography-led layout).** The nine
homepage images in `public/products/*.jpg` are **off-brand AI composites**, not
real product photography, and they are keyed by `src/lib/catalog/fragrance-meta.ts`
(home-only marketing constant, 9 slugs) — **not** the DB catalog (still 2 products).
Each carries burned-in marketing slogans (incl. "craftsmanship", a word the May
copy purge removed from rendered surfaces), a non-site URL (`loveliluxuryscents.com`),
a ✦ watermark, and busy gold-drenched backgrounds with inconsistent mood. Enlarging
them (the whole point of a photography-led layout) amplifies all of it, and the
reference card style (image-above-text on cream) can't ship until they're clean
because the current dark-overlay cards are partly *hiding* the burned-in text.

**Render brief written** (`docs/photography-render-brief-2026-05.md`, owner-facing).
Recommends regenerating with **no legible text** (monogram only — sidesteps text
garble and the brand-name question), clean neutral backdrop, one bottle, soft
daylight, 3:4, with exact per-slug filenames to drop straight into
`public/products/`. Owner action: generate + replace; then I move FeaturedGrid to
the reference image-above-text cards.

**Layout pass (photo-independent, shipped + deployed).** Airier vertical rhythm on a
deliberate 3-tier scale: strips stay tight (TrustStrip `py-14 md:py-20`); content/
grid sections → `md:py-40 lg:py-48` (FeaturedGrid, FindYourScent, CustomerProof,
DistributorCTA, FAQ); pure editorial statements → `md:py-48 lg:py-56` (Story,
Philosophy). More space around headers (`mb-16 md:mb-24`, eyebrow→h2 `mt-5`), bigger
card gaps (`gap-8`), Hero desktop padding `py-24 lg:py-40` + `lg:gap-16` + `min-h-[90vh]`.
(Values deepened on 2026-05-27 per owner feedback — "more air".) Softened the two
dark-theme shadow holdovers in `Hero.tsx` (bottle `drop-shadow` and ground ellipse)
to warm low-opacity values so the bottle no longer sits in a muddy black shadow on
cream. Reference (mondedesparfum.com) is all-sans, but the brand-brief serif
display (Cormorant) is kept per the Appendix E decision — we match the airiness and
photography direction, not the typeface.

**Brand name (RESOLVED 2026-05-27).** Owner ruled the canonical name is **"Loveli
Luxury Scents"** with tagline **"Where Love Meets Luxury"** — i.e. the code
(`src/app/layout.tsx`, `PublicFooter.tsx`, `Story.tsx`) was already correct; the
docs' "Loveli Luxury" is just loose shorthand. Do NOT strip "Scents". The
`loveliluxuryscents.com` URL matches the name (prod deploy stays
`loveli-luxury.vercel.app`). The existing product images therefore had the *right*
name on the label; their problems are the burned-in slogans, watermark, and busy
backgrounds only.

**Verification:** tsc clean · 376/376 tests (27 suites) · `next build` green ·
deployed to prod (`READY`) · live homepage HTTP 200 with the new `md:py-36`/`md:py-44`
spacing utilities present in served HTML.

## Appendix G: `payment_attempts` audit-trail fix (2026-05-28)

**Finding.** Owner asked "what's pending to make the system fully functional";
the runbook flagged `payment_attempts` as silently failing. The live table had
**0 rows after 15 PayHero STK orders**, removing the STK audit trail.

**Root cause — column drift.** Migration 019 documented a 10-column
`payment_attempts` schema, but the live table had only **7** columns
(missing `attempt_type` NOT NULL, `http_status`, `error_message`). An earlier
hand-applied DDL had created the table; 019's `CREATE TABLE IF NOT EXISTS`
was therefore a silent no-op and the new columns never landed. Every
dispatcher insert sent `attempt_type` and `error_message`; PostgREST returned
`column does not exist` in the resolved `{ error }`; the best-effort wrapper
awaited the insert without inspecting `error`, so the failure was completely
silent. (Classic idempotent-migration trap: `CREATE TABLE IF NOT EXISTS`
doesn't reconcile columns — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` does.)

**Fix.**
- **Migration 030 (`030_payment_attempts_column_drift.sql`)** — `ALTER TABLE
  ADD COLUMN IF NOT EXISTS` for the three missing columns, backfill
  `attempt_type='stk_push'` defensively, `SET NOT NULL` on `attempt_type`,
  audit-log entry, and `NOTIFY pgrst, 'reload schema'`. Applied via MCP and
  verified live by inserting a row in the dispatcher's exact shape (success).
- **Dispatcher (`src/lib/payments/dispatcher.ts`)** — `logAttempt` and
  `updateOrderProviderRefs` now destructure `{ error }` from the awaited
  supabase response and `console.warn` on failure. `logAttempt` exported so
  the contract is testable. Defense in depth: even if a future drift recurs,
  it can't be silent.
- **Regression test (`tests/unit/payment-attempts-audit.test.ts`, 4 tests)**
  — pins the "stays quiet on success, warns on `{ error }`, warns on throw,
  never throws" contract.

**Verification.** tsc clean · **28 suites / 380 tests** (up from 27 / 376) ·
`next build` green · deployed to prod (READY) · prod insert path proved
against the live schema via a synthetic row.

**Sibling finding (resolved 2026-05-28).** `webhook_deliveries` is at 0 rows
all-time despite 4 paid/fulfilled PayHero orders. Investigated:
`record_webhook_delivery` works when called directly (proved by inserting +
deleting a probe row); the webhook route's flow is correct. The paid orders
were admin-reconciled — the M-Pesa receipt was pasted in from the PayHero
dashboard and the same RPC chain run via
`src/app/api/payhero/reconcile/route.ts` or
`src/app/(admin)/admin/orders/[id]/actions.ts`. Not a code bug; just nobody
has driven a real PayHero callback through our endpoint yet. End-to-end
verification belongs to the Go-Live smoke test (`docs/go-live-mpesa.md` §6).

## Appendix H: E1 — Crown President "75 active customers" (2026-05-28)

**Shipped.** The first of the two deferred comp-engine items from Appendix C.
Crown President (rank position 5) now enforces a minimum of **75 distinct
retail customers per qualifying month**, on top of its existing 120-active-recruits
and KES 7.5M group-sales requirements. Ranks 1–4 are unaffected.

**"Active customer" definition** (locked, per-month):

> For partner D in calendar month M, an *active customer* is a distinct retail
> buyer — deduped by `COALESCE(user_id::text, customer_phone, customer_email::text)`
> — who placed at least one order where `sponsor_distributor_id = D.id`,
> `kind <> 'distributor_signup'`, `status IN ('paid','fulfilled','shipped','delivered')`,
> and `paid_at` falls within M.

**Migration 031** (`031_e1_crown_president_active_customers.sql`):
- Adds `config_ranks.min_active_customers INTEGER` (NULL = no requirement).
- Adds `gsv_snapshots.active_customers_count INTEGER NOT NULL DEFAULT 0`.
- Versioned config update — closed the prior Crown President row (id 28) at
  NOW(), inserted a new row (id 29) carrying `min_active_customers = 75`.
  Past-month evaluations against the OLD row continue to pass NULL → no
  requirement (no retroactive de-qualification). Future evaluations pick the
  new row and enforce 75.
- Extends three engine functions:
  - `compute_gsv_snapshot` — now also counts and writes `active_customers_count`.
  - `is_distributor_qualified_for_rank` — gate adds
    `(v_rank_min_customers IS NULL OR v_active_customers >= v_rank_min_customers)`.
  - `detect_rank_up` — selector adds
    `(min_active_customers IS NULL OR min_active_customers <= v_active_customers)`.

**Partner dashboard** (`/account/partner`) — when the next rank has an active-customers
requirement (currently only Crown President), the progress section renders a third
**"Active customers"** progress bar alongside the existing recruits and revenue
bars. The progress grid widens to `lg:grid-cols-3`.

**Stale-types note.** `src/types/database.ts` doesn't yet carry the new columns,
so the dashboard casts the typed selects through `unknown` for now. The proper
regen is the P3 housekeeping item; the local cast is documented in-place.

**Verification.**
- Live config: Crown President (id 29) `min_active_customers = 75`,
  ranks 1–4 NULL ✓
- All three engine functions carry the new column / gate (probed via
  `pg_get_functiondef`) ✓
- `compute_gsv_snapshot(2, 2026, 5)` ran cleanly against the root distributor
  and wrote `active_customers_count = 0` ✓
- `is_distributor_qualified_for_rank` returns FALSE for both Ambassador and
  Crown President for the root in May 2026 (expected — they don't meet GSV
  / recruits thresholds either) ✓
- tsc clean · 28 suites / 380 tests · `next build` green · deployed (`READY`)

**Still deferred — E2 (maintenance grace-period).** Personal-PV maintenance gate
remains at 0 until E2 ships. Owner-prompted next when ready.

## Appendix I: Types regen, E2 (maintenance grace), performance pass (2026-05-28)

### Types regen (P3 housekeeping — done)
`src/types/database.ts` regenerated against the live schema via the Supabase
MCP. The new generator renders BIGINT as `number` (newer behaviour), where
the codebase's custom types and many `*_minor: string` declarations relied on
the older `string` representation. Two sed passes brought everything in line:

- All `_minor: string` and `_minor: number` declarations in the generated
  types widened to `_minor: string | number` (covers Row/Insert/Update).
- All `_minor: string` declarations in `src/` custom types and DTOs widened
  to `_minor: string | number` to match — the union keeps `BigInt(...)` /
  `formatKes(...)` callers working unchanged.
- A handful of consumer sites (`AdminBundleForm`, `AdminVariantsEditor`,
  `BundleAddToCart`) wrap `String(...)` around values destined for
  string-only sinks.

The `as unknown as` casts added to `src/app/(public)/account/partner/page.tsx`
during E1 are now dropped — `min_active_customers` and `active_customers_count`
are first-class in the types.

### E2 — maintenance grace-period scaffolding (migration 032)
Ships the engine wiring for the second deferred comp rule, with the gate
intentionally **inert** until the owner sets a policy.

- `config_ranks.maintenance_grace_months INTEGER NULL` — NULL / 0 = strict
  maintenance (lock on first failed month). Positive N = a partner stays
  *maintained* even when failing the PV threshold, as long as fewer than
  N+1 of their last months were consecutive fails. Any passing month resets.
- `is_distributor_meeting_pv(distributor, year, month)` — the strict
  per-month check (lifted from the old `is_distributor_maintained` body,
  unchanged semantics). Independently callable so the grace-aware wrapper
  doesn't recurse on itself.
- `is_distributor_maintained(distributor, year, month)` — grace-aware
  wrapper: strict pass returns TRUE immediately; otherwise walks back up to
  `maintenance_grace_months` months calling the strict helper until either a
  passing month is found (streak broken → still maintained) or the window
  is exhausted (lock).

Current state: every rank has `min_personal_pv = 0` from migration 029, so
`is_distributor_meeting_pv` short-circuits to TRUE and the grace branch is
never entered. **Gate is OFF until you set per-rank PV + grace numbers.**

Owner activation (when ready): UPDATE the active config_ranks rows with
versioning (close current with `effective_until = NOW()`, insert new row
with the new values + the new column set). No code change required.

### Performance pass
- `next.config.js` `images.deviceSizes` narrowed from the default 8-wide
  matrix to `[360, 414, 480, 768, 1024, 1280, 1920]` — mobile-first Kenyan
  4G; fewer variants generated and cached. `imageSizes` similarly trimmed.
- `images.minimumCacheTTL = 31536000` (1 year). Static product photography
  rarely changes; cache aggressively at the edge.
- `FeaturedGrid` card image `quality={65}` (down from default 75) — visually
  indistinguishable at thumbnail scale, meaningful byte savings across the
  9-card grid below the hero.
- WhatsApp concierge + wishlist hydrator dynamic-imported with
  `ssr: false, loading: () => null` so they ship after hydration rather
  than in the initial JS payload that runs before LCP.

### Security advisors (snapshot, not addressed this session)
For the owner's awareness — Supabase advisors flagged these PRE-EXISTING
issues unrelated to today's work:

- `public.payment_audit_logs` has RLS enabled but no policies.
- `public.audit_log` has an INSERT policy with `WITH CHECK true` (permissive).
- A handful of SECURITY DEFINER functions are callable by anon/authenticated
  via PostgREST RPC (some intentional, some worth tightening).
- `auth.users` leaked-password protection is disabled in Supabase Auth.
- `function_search_path_mutable` warnings on a few legacy helpers (`set_updated_at`,
  `has_role`, `generate_sponsor_code`, etc.) — best practice to pin search_path.
- `citext` extension is installed in the `public` schema.

None block Go-Live; treat as a separate hardening pass.

### Verification
tsc clean · 28 suites / 380 tests · `next build` green · deployed to prod
(READY) · live homepage HTTP 200 · `is_distributor_meeting_pv(2, 2026, 5)`
and `is_distributor_maintained(2, 2026, 5)` both return TRUE (gate inert) ·
new `config_ranks.maintenance_grace_months` column verified live.

## Appendix J: Security advisor sweep + DRY refactor + stale-doc cleanup (2026-05-28 cont.)

### Distributors RLS recursion — fixed (migration 033)
Postgres logs were showing `infinite recursion detected in policy for relation
"distributors"` on real reads. Root cause: the `distributors_downline_read`
policy contained a subquery `SELECT id FROM distributors WHERE user_id =
auth.uid()` — Postgres triggered RLS on the inner SELECT, which evaluated this
same policy, which queried `distributors` again, ad infinitum.

Fix: hoisted the user→distributor lookup into a `SECURITY DEFINER` helper
`public.current_distributor_id()` (search_path-pinned, granted only to
authenticated + service_role, not anon). The helper bypasses RLS when reading
`distributors`, breaking the recursion. The policy now reads:

```sql
USING (id IN (
  SELECT dt.descendant_id FROM distributor_tree dt
   WHERE dt.ancestor_id = public.current_distributor_id()
))
```

Verified: `SELECT count(*) FROM distributors` against the live database now
succeeds (5 rows), no recursion in the postgres log.

### Security advisor sweep — migration 033 (other items)
Bundled into the same migration:
- **`payment_audit_logs`** — table had RLS enabled with no policy →
  effectively service-role-only. Added admin/superadmin policy mirroring
  `payment_attempts`.
- **`function_search_path_mutable`** — pinned `search_path = public, pg_temp`
  on 7 legacy helpers (`set_updated_at`, `has_role`, `generate_sponsor_code`,
  `generate_order_number`, `get_setting_bool`, `rebuild_distributor_tree_for`,
  `add_distributor_to_tree`).
- **`audit_log` permissive INSERT** — old policy was `WITH CHECK (true)` (any
  client could insert any actor_id). Replaced with
  `WITH CHECK (actor_id IS NULL OR actor_id = auth.uid())` — service_role and
  SECURITY DEFINER writes still pass, client impersonation is blocked.
- **Engine RPCs locked to service_role** — `REVOKE EXECUTE FROM anon,
  authenticated` on `is_distributor_meeting_pv`, `is_distributor_maintained`,
  `is_distributor_qualified_for_rank`, `count_qualifying_streak`,
  `compute_partner_qualifications`, `refresh_partner_qualifications`.
  `has_role` and `default_sponsor_code` stay accessible (RLS helpers + the
  signup flow require them).

### Owner-side advisor items (NOT addressed in 033, see owner-action guide)
- `auth_leaked_password_protection` — Supabase Auth dashboard setting.
- `extension_in_public` (citext) — schema move, data-type churn.
- `public_bucket_allows_listing` (catalog storage bucket) — needs an audit of
  admin code before tightening.

### DRY refactor — `applyPaymentSuccess` helper
The post-payment chain (stamp refs → `mark_order_paid` → `provision_distributor`
→ `write_commission_ledger` → `recordV2Preview` → `sendOrderReceipt` → audit
row) was duplicated across **5 call sites**:

1. `src/app/api/payhero/webhook/route.ts` (webhook push)
2. `src/app/api/payhero/reconcile/route.ts` (admin-API reconcile)
3. `src/app/(admin)/admin/orders/[id]/actions.ts` (admin server-action)
4. `src/app/api/payhero/status/route.ts` (status-poll self-heal)
5. `src/app/api/cron/reconcile-pending/route.ts` (cron sweeper)

Extracted to **`src/lib/payments/apply-payment-success.ts`**. The helper
returns `{ paid, warnings, error }` so each caller surfaces failures in
whatever shape suits it (HTTP response, server-action throw, console.warn,
audit row). Each call site shrunk from ~70 lines of inline chain to ~10–20
lines invoking the helper. A future bug fix lives in one place, not five.

Trade-off: the helper writes an audit_log row tagged with the path that
drove it (`payment.applied.webhook`, `payment.reconciled.cron`, etc.) — so
webhook payments now leave both a `webhook_deliveries` entry AND an
`audit_log` entry. Acceptable: more visibility, not less.

### Stale-doc cleanup
`README.md`, `HANDOFF.md`, `TODO.md` all pre-dated the transformation —
they claimed Flutterwave, 246 tests, Phase 8 ship-ready. Rewrote each as a
short pointer/banner directing readers to the canonical docs
(`PROJECT-BRIEF`, `transformation-masterplan-2026-05`,
`delivery-punchlist-2026-05`, `go-live-mpesa`). Stops them from
actively misleading anyone landing on the repo.

### Verification
tsc clean · **28 suites / 380 tests** · `next build` green · deployed to
prod (`READY`) · live functional probe of `current_distributor_id()` and a
`SELECT count(*) FROM distributors` both succeed without recursion.

## Appendix K: v2 4-tier scaffolding removed (2026-05-28 cont.)

Owner confirmed removal — the v2 engine has been dormant since the
2026-05-22 decision to stay on the 5-rank v1 model (Appendix C). Carrying
two engines invites the next engineer to wonder which matters.

**Migration 034** dropped, in order:
- `compute_partner_qualifications(bigint)` + `refresh_partner_qualifications()` RPCs.
- `partner_qualifications` materialized view.
- `partner_tiers` table (6 rows of Concierge / Brand Associate / Regional Curator / Prestige + 2 audit rows).
- `distributors.current_tier_id` column (was set on 3 pre-decision rows).
- `commission_ledger.compensation_engine` + `tier_at_time_id` columns.
- `commission_ledger_v2_preview` table (2 dry-run rows from order 11 + 20).

**Code purged**:
- `src/lib/payments/engine-v2-tier.ts`
- `src/lib/payments/record-v2-preview.ts`
- `src/lib/partners/qualification.ts`
- `src/lib/partners/types.ts`
- `src/lib/partners/tier-evaluator.ts`
- `src/app/(admin)/admin/comp/tiers/` (entire directory)
- `src/app/(admin)/admin/comp/partner-qualifications/` (entire directory)
- `tests/unit/engine-v2-tier.test.ts`
- `tests/unit/record-v2-preview.test.ts`
- `tests/unit/partner-tier-evaluator.test.ts`

**Edits**:
- `apply-payment-success.ts` lost step 5 (v2 preview gate) and the
  `getServerEnv` + `recordV2Preview` imports. Chain is now 6 steps
  (was 7).
- `commission-health` admin page lost its v1-vs-v2 dry-run section;
  the "orders missing commissions" backfill remains.
- `AdminSidebar.tsx` lost the "Partner tiers" and "Qualifications" nav items
  (Comp section is now Starter packages + Commission health).
- `env.ts` lost `COMPENSATION_ENGINE` (was a 3-value enum gating the v2
  dry-run; pointless now).

**Kept on purpose**:
- `src/lib/partners/tiers.ts` — already rewritten on 2026-05-22 to map the
  5 v1 ranks (Ambassador → Crown President) for the `TierBadge` UI.
- `tests/unit/partner-tiers.test.ts` — tests the 5-rank mapping.
- `config_ranks` + `distributors.current_rank_id` + `commission_ledger` —
  the production v1 engine.

**Stale-type follow-up**: `src/types/database.ts` still describes the dropped
tables and columns. No code references them, so runtime is unaffected, but
a future `generate_typescript_types` regen should sweep this. Folded into
the P3 housekeeping list.

**Verification**: tsc clean · **25 suites / 355 tests** (down from 28 / 380
after dropping the 3 v2 test files; no other tests affected) · `next build`
green · deployed to prod (`READY`) · live DB state confirms partner_tiers,
partner_qualifications, commission_ledger_v2_preview, and the relevant
columns no longer exist.

## Appendix L: Site content CMS — Phase 1 (2026-05-28 cont.)

Closes a recurring client gripe: anything *editorial* on the front side was
hardcoded in components. Phase 1 ships the framework + four high-impact
homepage sections; Phase 2 will extend to footer, partner landing,
philosophy, policies.

**Migration 035** adds `site_content (section_key TEXT PK, body JSONB,
updated_at, updated_by)` with public-read / admin-write RLS and an
`updated_at` trigger. Seeded with rows for `home_hero`, `home_trust_strip`,
`home_story`, `home_faq` matching the in-code defaults so a fresh DB and a
never-touched DB look identical.

**`src/lib/content/site.ts`** owns the schema + defaults + reads:
- One Zod schema + defaults constant per section, registered in a single
  `SECTIONS` lookup with editor labels and descriptions.
- `getSection<K>(key)` returns the parsed body or falls back to the in-code
  default if the row is missing OR fails schema validation. **A bad edit
  cannot break the site.**
- `getAllSectionMetas()` powers the admin index page.

**`src/components/content/HighlightText.tsx`** parses `*asterisk*` runs and
renders them as italic + primary-color emphasis — so the admin can write
`"Things people *ask*."` without touching HTML.

**Components wired to DB content** (with their hardcoded defaults intact as
the fallback):
- `Hero.tsx` — now accepts `copy: HeroContent` as a prop; `page.tsx`
  awaits `getSection('home_hero')` server-side and passes it through. Hero
  remains client-side for the bottle rotation.
- `FAQ.tsx` — async server component, fetches `home_faq`.
- `Story.tsx` — async server component, fetches `home_story`.
- `TrustStrip.tsx` — async server component, fetches `home_trust_strip`;
  icon strings map through `ICON_MAP` to lucide components.

**Admin surfaces**:
- `/admin/content/site` — index listing the four sections with their
  labels, descriptions, and last-updated timestamp. Sections with no DB row
  show an "UNCONFIGURED — showing defaults" badge.
- `/admin/content/site/[section]` — per-section editor (`SectionEditor.tsx`
  client component): pretty-printed JSON in a textarea, Save / Reset to
  defaults buttons, schema reference collapsed below.
- Server actions in `actions.ts`: `saveSectionContent` parses JSON →
  validates with Zod → upserts → `revalidatePath('/')` to bust the
  statically-cached homepage. `resetSectionToDefaults` deletes the row so
  `getSection` falls back to the code default.
- Admin sidebar got a "Site content" entry under the Content group
  (alongside the existing Social proof).

**Phase 2 candidates** (no schema change, just add a row + wire the
component): `home_philosophy`, `footer`, `partner_landing`, the three
`policies_*` pages, `home_find_your_scent` (quiz prompts), `home_marquee`.
Each is ~30 minutes once the pattern is in place.

**Verification**: tsc clean · 25 suites / 355 tests · `next build` green ·
deployed to prod (READY) · homepage 200 with the DB-seeded subhead in the
rendered HTML · `/admin/content/site` correctly gated (307 to sign-in).

## Appendix M: Ruth's final comp plan adopted (2026-05-28)

After two prior drafts (an original 8-rank / 40% / LIFETIME-salary HTML, and a
"revised suggested" 7-level / 25.5% / leadership-pool PDF) Ruth's final adopted
plan landed — and **it matches almost exactly what migrations 029 + 031 had
already configured.** The only delta was the active-customer threshold per
rank.

**Per-rank `min_active_customers` versioned via migration 036:**

| Rank | Pos | Before | After |
|---|---|---|---|
| Ambassador | 1 | NULL | **5** |
| Executive | 2 | NULL | **20** |
| Gold Director | 3 | NULL | **50** |
| Platinum Director | 4 | NULL | **80** |
| Crown President | 5 | 75 | **130** |

Every other parameter — commission L1–L5 at 20/11/6/2/1, 30ml & 50ml pricing
(700/1500 + 1400/2800), PV (350 / 700), group targets (100k → 7.5M ladder),
active directs (5 → 120 ladder), rank bonuses (5k → 300k), qualifying months
(2/3/3/2/3), monthly lifestyle bonuses (0/5k/20k/100k/250k), personal bottles
(5/10/15/25/35) — already matched. The engine work shipped in E1 (column,
snapshot field, qualification gate, dashboard progress bar) was the right
scaffolding; migration 036 just filled in the per-rank values.

**Versioned per the established `config_ranks` pattern**: each updated row
closed at NOW() with effective_until, replaced by a new row carrying the
adopted threshold and effective_from = NOW(). Past-month rank evaluations
against the old rows keep their original thresholds (no retroactive
de-qualification); current/future evaluations use the adopted ones.

**Verification**: live `SELECT * FROM config_ranks WHERE effective_until IS
NULL ORDER BY rank_position` returns the adopted values cleanly. Dashboard
at `/account/partner` already reads `min_active_customers` from the active
config row, so the "Active customers" progress bar surfaces against the
adopted thresholds without further code change.

**Status now**: the comp engine reflects Ruth's adopted plan in full.
E2 (maintenance grace-period) scaffolding remains shipped-but-inert pending
the owner setting `min_personal_pv > 0` and `maintenance_grace_months > 0`
per rank (Appendix I). A legal review before real-money Go-Live is still
recommended.

## Appendix N: CMS Phase 2 + superadmin actions (2026-05-28)

### Site content CMS Phase 2 (partial)
- **Migration 037** seeded two new sections: `home_philosophy` and `footer`.
- `lib/content/site.ts` registry extended with `philosophySchema`/`footerSchema` + defaults.
- `FragrancePhilosophy.tsx` rewritten as async server component using `getSection`.
- `PublicFooter.tsx` accepts a `copy: FooterContent` prop; the public layout
  fetches via `getSection('footer')` and passes through. Link structure stays
  in code (each link ties to a real route); only the editable copy fields are
  in the CMS.
- Admin editor's `SCHEMA_HELP` extended with field references for both new
  sections.
- Deferred to Phase 3: `partner_landing` (hero of `/partners`), `policies × 3`,
  `home_find_your_scent` quiz, `home_marquee`.

### Superadmin authentication
- `isSuperadmin(session)` + `requireSuperadmin()` added to `src/lib/auth/roles.ts`
  to gate destructive operations.

### `/admin/system/users` — account deactivation (superadmin only)
- New page lists every Supabase Auth user with current roles + ban state.
- Soft-delete pattern chosen over hard delete: revoke all roles → ban for
  ~100 years → anonymise email → audit row. Reversible by engineer with DB
  access; strictly better than `auth.admin.deleteUser` which would cascade-
  orphan downstream rows we want for audit.
- **Four protected accounts** (`capernstone@`, `ashishke79@`,
  `ashirumaabala1@`, `rymiruzz@`) are guarded server-side AND in the UI per
  the authorized-accounts memory.
- Self-deactivation blocked.
- Confirmation requires typed match of the target email.
- New "Users (superadmin)" entry in admin sidebar under System.

### `/admin/orders/[id]` — void & purge erroneous orders (superadmin only)
- New `purgeOrder` server action enforces four guards before any delete:
  1. Status in `pending / cancelled / expired / failed` only.
  2. `paid_at IS NULL`.
  3. `payhero_mpesa_receipt IS NULL` (no real money moved).
  4. Zero `commission_ledger` rows reference the order.
- On purge: order + items + payment_attempts cascade-delete; `audit_log`
  receives an `order.purged` row with full before-snapshot. Audit row is
  append-only — the deletion record survives the deletion.
- UI: a rose-themed "Erroneous order — superadmin purge" section renders on
  the order detail page only when the user is superadmin AND all four guards
  pass. The button never appears for orders that touched real money.

**Verification**: tsc clean · 25 suites / 355 tests · `next build` green ·
deployed (`READY`).

## Appendix O: Cart breakdown + PDP overhaul + env activations (2026-05-28)

### Per-variant line items in cart + checkout (1c)
- `BundleCartLine` gained an optional `contents: Array<{name, sizeMl, qty}>`
  field. Snapshotted at add-time in `BundleAddToCart.tsx` from `bundle.items`.
- `CartLineItem.tsx` renders the contents as an indented bullet list under
  the bundle line in the cart drawer + cart page. Legacy lines (no contents)
  silently degrade to bundle-name only.
- No DB work needed; everything stored client-side in the existing
  localStorage cart shape.

### PDP overhaul (2)
- **Migration 038** added `homepage_reviews.product_id` (nullable FK to
  products). Rows with `product_id IS NULL` stay in the homepage carousel;
  rows with a value light up the matching PDP. `getPublishedReviews()`
  filtered to NULL only; new `getProductReviews(productId)` for PDP.
- **`SimilarProducts.tsx`** + **`getSimilarProducts(productId, scentFamily)`**
  query `product_fragrance_meta` for other active products in the same
  scent_family. Cheapest active variant + primary thumb fetched in two
  bulk reads. Renders nothing when scent_family is null or no matches.
- **`ProductReviews.tsx`** renders product-tied reviews in a 2-col grid
  under the FragranceDetail block. Silent when none exist.
- **Notes pyramid** — `FragranceDetail.tsx` Notes block restructured from
  3-column grid into a vertically stacked pyramid (top narrowest, base
  widest) with each tier as a soft bordered card. Reads as a clear visual
  silhouette without graphics.
- **Layout pass** on `/p/[slug]`: container widened from `max-w-6xl` to
  `max-w-7xl`, two-column split tilted to favour the gallery
  (`lg:grid-cols-[7fr_5fr]`), larger title (`text-5xl md:text-6xl` serif),
  gap increased to `lg:gap-16`, padding tightened.
- Existing structured data, recently-viewed strip, and WhatsApp concierge
  link untouched.
- TODO for the admin form: expose the `product_id` dropdown in
  `/admin/content/social-proof` so Ruth can attach a review to a product
  from the UI (currently settable only via SQL). Deferred to next pass —
  small UI change.

### Env activations confirmed by owner (2026-05-28)
| Env | Status |
|---|---|
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | ✅ active — receipts fire on paid orders |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | ✅ active — rate-limiting on init routes |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | ✅ active — client + server error capture |
| `ENFORCE_ADMIN_MFA=true` | ✅ active — admins must complete aal2 step-up |
| External cron scheduler hitting `/api/cron/reconcile-pending` | ✅ active — sweeper firing |

The PayHero webhook GET diagnostic still confirms `envTokenSet=true,
envTokenLength=64`. Sentry's module names get webpack-hashed in the client
bundle so it doesn't appear as a literal "sentry" string — that's expected
when the SDK is loaded via `@sentry/nextjs`. Owner-side leaked-password
protection toggle in Supabase Auth was not in the confirmation set —
worth checking on next sweep.

### Verification
tsc clean · 25 suites / 355 tests · `next build` green · deployed
(`READY`) · homepage 200 · PDP routes 200 with the preloaded LCP image
in the HTML.

## Appendix P: Split-shipment — scoping proposal (deferred)

The customer-driven "ship items separately" feature (item 1b on the queue)
is genuinely a multi-day build because it changes the order/shipment data
model, not just UI. Capturing the scope here so the next session starts
from a clean spec.

### Scope summary
Today, one `orders` row carries N `order_items`, and the whole order ships
or doesn't ship as a unit. Split-shipment lets the customer split items
into 2+ separate shipments at checkout, each with its own:
- shipping address (optionally — could enforce same address but staggered
  dispatch),
- shipping fee,
- tracking number,
- fulfilment state (`pending → shipped → delivered`),
- delivery ETA.

### Schema sketch
```sql
CREATE TABLE shipments (
  id            BIGSERIAL PRIMARY KEY,
  order_id      BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status        TEXT   NOT NULL DEFAULT 'pending',
  shipping_address_id BIGINT REFERENCES addresses(id),
  shipping_minor BIGINT NOT NULL DEFAULT 0,
  tracking_number TEXT,
  carrier        TEXT,
  shipped_at    TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items
  ADD COLUMN shipment_id BIGINT REFERENCES shipments(id) ON DELETE SET NULL;
```

Existing single-shipment orders backfill as one synthetic shipment per
order so admin UIs stay uniform.

### Decisions the owner needs to make
1. **One address per shipment, or all-same-address with staggered
   dispatch?** Per-address is more flexible (gift-to-multiple), more
   complex.
2. **Per-shipment shipping fees** — flat per-shipment, or recalculated by
   weight/destination per shipment? Today shipping is a single line on the
   order.
3. **Customer trigger** — does the customer *choose* to split, or does the
   system *recommend* a split (e.g. bundles vs single bottles ship from
   different warehouses)? Default for v1: customer-chosen.
4. **Cancel/refund semantics** — can a customer cancel one shipment while
   the other proceeds? Refund the cancelled portion only?

### Estimated work
- Day 1: schema + migration + admin UI to manage multiple shipments per
  order (state transitions, per-shipment tracking inputs).
- Day 2: customer-facing checkout — "Ship this in separate parcels"
  toggle + per-shipment address picker + per-shipment fee preview.
- Day 3: receipts, order-tracking page, refund flow rewrite, audit.

Ping when ready; the policy questions above gate the build.

## Appendix Q: PDP review form + CMS Phase 3 + types regen (2026-05-30)

Three engineering-ready items from the punch-list — shipped in one pass.

### PDP review form: product_id dropdown
Closes the small UI gap left open in Appendix O — admins could only attach
reviews to a PDP via SQL. Now exposed in `/admin/content/social-proof`:

- **Create form** got an "Attach to" `<select>` populated from active
  products. Default = "Homepage carousel" (preserves the old behaviour:
  `product_id = NULL` → brand-wide rotation).
- **Each existing review row** got a "Move to" reassign dropdown that
  invokes a new `reassignReviewProduct` server action — lets the admin
  retarget a review without losing the text.
- **Cache invalidation**: `revalidatePath('/p/[slug]', 'page')` fires
  on create / delete / toggle-published / reassign so the PDP gallery
  picks up changes within a beat. `toggleReviewPublished` + `deleteReview`
  now read the row's prior `product_id` first so the right PDP gets
  busted, even when a review is being removed from a PDP entirely.
- **Zero schema work** — migration 038 already added the column; this
  was purely UI + actions.

### Site content CMS — Phase 3 (migration 039)
Closes the framework that landed in 035 / 037. All editorial copy on
public surfaces is now admin-editable; engineering touches stop being
the bottleneck for marketing edits.

**Migration 039 (`039_site_content_phase3.sql`) seeded six new sections:**

| Key | Surface | Schema highlights |
|---|---|---|
| `partner_landing` | `/partners` hero block | eyebrow, headline (`*highlight*`), microtag, subhead, primary + secondary CTA, invite note |
| `policies_authenticity` | `/policies/authenticity` | lead, intro, N section blocks (title + body and/or bullets) |
| `policies_delivery` | `/policies/delivery` | lead, intro, zones table (label/window rows), trailing section blocks |
| `policies_refund` | `/policies/refund` | lead, intro, qualifying-bullets block, trailing section blocks |
| `home_find_your_scent` | homepage quiz | eyebrow, headline, result eyebrow, meet-CTA prefix, retry label, 3 steps × 4 options |
| `home_marquee` | homepage brand strip | separator + items array |

**Code wiring** — `src/lib/content/site.ts` registry extended with six
schemas + defaults; SECTION_KEYS / SECTIONS auto-pick them up so the
admin index page lists them with the "UNCONFIGURED — showing defaults"
badge until the migration is applied (and "Last updated" timestamps
afterwards). `SCHEMA_HELP` in the per-section editor extended with field
references for all six. Components converted to async server components
that read via `getSection()`:

- `/partners/page.tsx` — hero block reads `partner_landing`; the rest of
  the page (tier ladder, integrity rules, how-to-start) stays in code
  since the structure ties to `ALL_PARTNER_TIERS` and aspirational copy
  the brand wants kept stable.
- `/policies/{authenticity,delivery,refund}/page.tsx` — full bodies
  driven by the CMS. The shared `policySectionSchema` (title + optional
  body + optional bullets) lets each block render a paragraph, a
  bullet list, or both.
- `FindYourScent.tsx` stays client (state machine) and takes a `copy`
  prop, fetched by `page.tsx` alongside `home_hero`. Vibe tag enum stays
  in code so the matcher contract is intact — only labels are editable.
- `Marquee.tsx` flips to an async server component reading the CMS
  directly; the FRAGRANCES dependency dropped.

**Find-your-scent tag enum** — `'soft' | 'mysterious' | 'fresh' | 'bold'
| 'warm'`, bound to `FragranceMeta['vibe']` in catalog/fragrance-meta.ts.
The schema field reference in `SCHEMA_HELP['home_find_your_scent']` calls
this out so the admin doesn't break the matcher with a free-text tag.

### Types regen (migrations 033 → 039) — task pulled forward from P3
Supabase MCP reconnected mid-session; `generate_typescript_types`
re-emitted `src/types/database.ts` (now 2115 lines vs. 2327 at the prior
regen — the v2-tier scaffolding drop in Appendix K is reflected). Same
two `_minor` widening passes that Appendix I established remain needed
because the generator still renders BIGINT as `number`:

- 54 `_minor: number` / `string` / `number | null` declarations in Row
  positions widened to `string | number` / `string | number | null`.
- 60 optional `_minor?: number` / `string` / `number | null`
  declarations in Insert / Update positions widened the same way.

114 widenings in total. Two regex passes via node, mirroring the
documented "two sed passes" approach so the codebase's `String(...)` /
`BigInt(...)` / `formatKes(...)` callers keep compiling unchanged.

The widened generated file is now in sync with migrations through 039.
Outstanding stale-types follow-up: the 22 files with `as unknown as`
casts on `site_content` / `homepage_reviews` / `press_features` /
`product_fragrance_meta` can drop those casts now that the new tables
are in the generated types — left as a quality pass since the casts
don't cause errors.

### Verification
tsc clean · **25 suites / 355 tests** · `next build` green · deployed
twice this session (`dpl_FThdpfrVcEqbiKFUHXTBnMUNecY9` pre-regen,
`dpl_6XCJsbbYxJWxMyHoPj18SbUCFCLN` post-regen) · live HTML probes:
`/policies/refund` carries `"What qualifies"` and `"Sealed and
second-guessing"` from the DB; `/partners` carries the
`"Loveli Luxury · Partner Program"` eyebrow and the
`"Build a *luxury fragrance* business"` headline with the italicised
highlight, all from `partner_landing` · all 12 `site_content` rows
present with `updated_at` correctly stamped (six fresh today, six from
prior sessions).

### What this leaves
- **Engineering-ready punch-list now empty** for items that were unblocked.
- **Owner-side / external** unchanged: PayHero B2C activation reply,
  Daraja Go-Live, real product catalogue, on-brand photography,
  Supabase Auth leaked-password toggle, legal review of the comp plan.
- **Decision-gated** unchanged: split-shipment (Appendix P, 4 owner Qs),
  E2 maintenance gate activation (per-rank PV + grace windows).
- **Optional quality pass**: drop the now-unnecessary `as unknown as`
  casts in the 22 files listed in Appendix I's stale-types note.

## Appendix — Source documents

- `docs/preflight-2026-05.md` — Phase 0 inventory
- `docs/phase1-plan-2026-05.md` — terminology + slug + migration proposal
- `docs/phase2-plan-2026-05.md` — compensation restructure (2a–2d)
- `docs/phase4a-plan-2026-05.md` — trust infrastructure
- `docs/photography-render-brief-2026-05.md` — owner brief to regenerate the homepage product images on-brand (Appendix F)
- `MIGRATION_NOTES.md` — proposed destructive schema changes (Phase 2)
- Brand brief (owner, 2026-05-18) — positioning, vocabulary, compensation rules, UI restraint, homepage structure, PDP fields, copy seeds
