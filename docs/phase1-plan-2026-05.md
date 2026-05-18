# Phase 1 plan — terminology + slug rename + migration proposal

**Locked scope (from 2026-05-18 sign-off):**
1. Customer-facing copy refactor — replace MLM vocabulary with the §3 luxury vocabulary.
2. Route rename `/distributors/*` → `/partners/*` with 301 redirects + sponsor-cookie path update.
3. `MIGRATION_NOTES.md` proposing the destructive changes (8-rank collapse to 4-tier, `monthly_salaries` rename, MLM-vocabulary column renames). **No destructive migrations ship in Phase 1.**

This document is the §11.1 plan. No code modifications until owner approves and says "go Phase 1".

---

## 1. Copy refactor — files touched, vocabulary swaps

### Vocabulary table (canonical for the whole refactor)

| Legacy term | New term | Notes |
|---|---|---|
| MLM / network marketing | Partner Program / luxury commerce partnership | The whole framing flip per §3. |
| Downline / your downline | Network / your referral network | Avoid hierarchical language. |
| Upline / sponsor (verb sense) | Sponsor (noun) / your sponsor | "Sponsor" as identity is fine; "sponsor someone" is fine. "Upline" is out. |
| Recruit / recruits | Partners you've invited / your referrals | Never "recruit" as verb; "invite" instead. |
| Rank up / rank | Tier / advance a tier | Tier is the customer-facing word. |
| Team Builder / Team Leader (rank 1-2) | Affiliate (tier 1) | See §3 mapping. |
| Supervisor / Manager (rank 3-4) | Brand Partner (tier 2) | |
| Senior Manager / Executive Manager (rank 5-6) | Executive Partner (tier 3) | |
| Legacy Builder / Ambassador (rank 7-8) | Prestige Partner (tier 4) | |
| Lifetime monthly salary | Performance retention bonus | "Lifetime" is out. Quarterly reviewed per §6.3. |
| PV / Point Value | Verified retail revenue (display) / `points` (internal) | Schema column stays `commission_pv` in Phase 1; copy uses "revenue". |
| Starter package | Onboarding kit | "Starter" survives in `is_starter_package` DB column until Phase 2. |
| Build a team / team building | Build your partner business | Reframe as entrepreneurial, not recruitment. |
| Recruitment | Invitation / referral | |

### Files to rewrite (Phase 1 copy targets)

| File | Lines (approx) | Scope of change |
|---|---|---|
| `src/app/(public)/boss-scents/page.tsx` | ~250 | **Largest single concentration (62 hits).** Full editorial rewrite. Comp plan presentation pivots from 8 ranks to 4 tiers (display only — schema stays 8 ranks); commission table reframed as "earnings per tier"; salary section becomes "retention bonus" with placeholder for v1; "Point Value" boxes reframed as "verified revenue per bottle"; recruitment language stripped. |
| `src/components/account/AffiliateUpgradeBanner.tsx` | ~80 | Strip "7 levels network commission", "lifetime monthly salary up to Kes 250,000". Replace with editorial tone: "Earn alongside the brand. Tier into Brand Partner and beyond." Tier ladder progression as career path, not income hierarchy. |
| `src/components/account/AccountStatusCard.tsx` | ~50 | Drop "Manager rank up qualify for lifetime monthly salary" — replace with tier-progress copy. |
| `src/app/(public)/distributors/signup/page.tsx` | ~280 | Heading + intro rewrite. The page itself moves to `/partners/signup` in §2 below; copy work here is just the strings. |
| `src/components/distributors/SignupForm.tsx` | ~570 | Section titles ("Sponsor" → "Your sponsor"; "Starter package" → "Choose your onboarding kit"; "Distributor terms" → "Partner agreement"). Submit-button label "Create my account" stays. Selected-tier badge instead of rank. |
| `src/app/(public)/account/distributor/page.tsx` | ~150-200 | Dashboard header copy: "Welcome, [name]" + tier label + "Your partner activity". "Active recruits count" → "Partners you've invited". "Downline size" → "Network size". "Next rank targets" → "Next tier targets". Numbers + DB schema stay the same. |
| `src/app/(public)/account/distributor/commissions/page.tsx` | ~60-80 | "Network commission" → "Tier commission" or just "Commission earned". |
| `src/app/(public)/account/distributor/downline/page.tsx` | ~80-120 | Page title "Your network", strip "downline" everywhere from copy (variable names stay `downline*` in Phase 1; renamed in Phase 2). |
| `src/app/(public)/account/distributor/share/page.tsx` | ~100-150 | Headline "Share your invite link". Body explains how to invite future partners (not "recruit"). |
| `src/components/header/AffiliateUpgradeLink.tsx` | ~15-20 | "Become an affiliate" → "Join the partner program" (or similar). |
| `src/components/home/DistributorCTA.tsx` | ~30 | Same. |
| `src/components/account/AccountStatusCard.tsx` | (covered above) | |

**NOT touched in Phase 1:**
- `src/types/database.ts` (auto-generated, follows schema renames in Phase 2).
- `src/lib/mlm/**` (module name stays for Phase 1; refactored in Phase 2 alongside schema).
- All admin pages under `src/app/(admin)/` — admins keep precise legacy terms for now.
- All migration `.sql` doc-comments.

---

## 2. Slug rename — `/distributors/*` → `/partners/*`

### Filesystem moves

| Old path | New path |
|---|---|
| `src/app/(public)/distributors/signup/page.tsx` | `src/app/(public)/partners/signup/page.tsx` |
| `src/app/(public)/account/distributor/` (entire subtree) | `src/app/(public)/account/partner/` |
| `src/app/api/distributor-signup/init/route.ts` | `src/app/api/partner-signup/init/route.ts` |

### Code references to update

- `src/middleware.ts` — sponsor cookie path constraint, admin/distributor auth gates, the `/distributors/signup` middleware redirect for already-a-distributor users.
- `src/app/post-login/page.tsx` — role-based router (distributor role → `/account/partner` now).
- `src/components/header/AffiliateUpgradeLink.tsx` and `src/components/home/DistributorCTA.tsx` — link `href` values.
- `src/app/(public)/checkout/return/page.tsx` — `AffiliateUpgradeBanner` consumer; banner's internal links too.
- `src/components/checkout/CheckoutForm.tsx` + `src/components/distributors/SignupForm.tsx` — fetch URLs (`/api/distributor-signup/init` → `/api/partner-signup/init`).
- `src/lib/payments/dispatcher.ts` — none expected; verify.
- `src/lib/email/affiliate-upgrade.ts` — stub, but check for any URL constants.

### Redirects (`next.config.js`)

Add a `redirects()` block with 301s:

```js
async redirects() {
  return [
    { source: '/distributors/signup', destination: '/partners/signup', permanent: true },
    { source: '/distributors/:path*', destination: '/partners/:path*', permanent: true },
    { source: '/account/distributor', destination: '/account/partner', permanent: true },
    { source: '/account/distributor/:path*', destination: '/account/partner/:path*', permanent: true },
    { source: '/api/distributor-signup/:path*', destination: '/api/partner-signup/:path*', permanent: true },
  ]
}
```

The API redirect is important so external invite links or any cached form submissions don't 404 silently.

### Sponsor cookie path

Currently set on `/r/[code]/page.tsx` (or middleware) with path `/`. Verify `/r/[code]` target redirect after rename — the cookie itself doesn't move because `path=/` is unchanged. The DESTINATION URL embedded in the OG image route and any shareable invite link does change.

### OG image route

`src/app/(public)/r/[code]/opengraph-image-2v2hif.tsx` (or similar) — verify the share URL it generates points at `/partners/signup` post-rename.

### Risk: SEO + active invite links

Existing invite links shared on WhatsApp / Instagram have `/distributors/signup` baked in. The 301 redirects handle this cleanly. No data loss because the sponsor cookie is set on `/r/[code]` which is unchanged.

---

## 3. `MIGRATION_NOTES.md` — non-executing proposal

New file at `MIGRATION_NOTES.md` (repo root) — the Phase 2 work plan. Contains:

### 3.1 Rank collapse — 8 → 4

Provisional Phase-1 mapping (refined in Phase 2 with §6.1 qualification rules):

| Current rank | Position | Phase 2 tier |
|---|---|---|
| Team Builder | 1 | Affiliate |
| Team Leader | 2 | Affiliate |
| Supervisor | 3 | Brand Partner |
| Manager | 4 | Brand Partner |
| Senior Manager | 5 | Executive Partner |
| Executive Manager | 6 | Executive Partner |
| Legacy Builder | 7 | Prestige Partner |
| Ambassador | 8 | Prestige Partner |

But §6.1 of the transformation prompt redefines tier qualification entirely (verified retail sales thresholds + retention score + content output). So the 8→4 mapping is a **transitional bridge for already-existing distributors** at the time of the Phase 2 migration. New signups after Phase 2 land directly in tier 1 (Affiliate) and progress per §6.1's rolling 90-day rules.

Proposed schema for Phase 2:
- New table `partner_tiers` (config) — 4 rows, each with `qualification_rules JSONB`, `commission_rate_basis_points`, `override_rate_basis_points`, `min_recruitment_rank`, etc. Per §6.3.
- New table `partner_qualifications` (materialized view) — rolling 90-day computed view of each partner's eligibility.
- Distributors get a `current_tier_id` column added (FK to `partner_tiers`).
- `current_rank_id` stays on the table during the transition — backfilled and gradually deprecated.
- The 8-rank `config_ranks` table is renamed `config_legacy_ranks` and kept read-only for audit; new partners never reference it.

### 3.2 `monthly_salaries` → `retention_bonus_grants`

Per §6.3. Proposed schema for Phase 2:

```sql
-- Drop the implicit-default behaviour: rows are EXPLICIT grants, not computed.
ALTER TABLE monthly_salaries RENAME TO retention_bonus_grants;
ALTER TABLE retention_bonus_grants RENAME COLUMN fixed_salary_minor TO base_grant_minor;
ALTER TABLE retention_bonus_grants RENAME COLUMN performance_bonus_minor TO performance_grant_minor;
ALTER TABLE retention_bonus_grants ADD COLUMN reviewer_id UUID REFERENCES profiles(id);
ALTER TABLE retention_bonus_grants ADD COLUMN review_period_quarter TEXT;
ALTER TABLE retention_bonus_grants ADD COLUMN review_metrics JSONB;
```

Existing rows: keep, with NULL in the new columns. Backfilling reviewer + period is an admin task.

### 3.3 Other column renames (MLM vocabulary)

- `distributors.sponsor_id` → keep. "Sponsor" is acceptable luxury vocabulary.
- `commission_ledger.level` → keep. Internal column, not customer-facing.
- `gsv_snapshots` table → rename to `revenue_snapshots`. Trivial; included in Phase 2.
- No `downline_count` column currently exists in the schema — computed via `distributor_tree`. Nothing to rename.

### 3.4 Admin & ops surfaces

Defer all `/admin/*` page renames to Phase 2. Phase 1 leaves admin UI vocabulary intact.

### 3.5 No destructive operations in Phase 1

This document is the proposal. Phase 2 (Compensation Plan Restructure) executes it.

---

## 4. Order of operations + verification

### Step order

1. Write copy changes first (no infrastructure risk).
2. Filesystem rename + middleware + redirects (medium risk, deploy-affecting).
3. Run `npx tsc --noEmit` — catches any stale imports.
4. Run `npm test` — confirm 277 tests still pass.
5. Run `npm run build` — confirm production build green.
6. Manual smoke: hit a few of the renamed URLs locally to confirm redirects + cookie behaviour.
7. Write `MIGRATION_NOTES.md`.
8. Commit on `main` with a single descriptive commit.
9. `git push origin main`.
10. `cd loveli-luxury && vercel deploy --prod --yes`.
11. Hit live URLs to verify: `/distributors/signup` → 301 → `/partners/signup`; existing invite links work; sponsor cookie still captured.

### Smoke test list

- Sign in as `ashirumaabala1@gmail.com`, click each header link → no 404.
- Visit `/distributors/signup` (logged out) → 301 redirect to `/partners/signup`.
- Visit `/r/<some-code>` → sponsor cookie set + redirect to `/partners/signup` or wherever the new target is.
- Visit `/account/partner` as a distributor → dashboard renders with new copy.
- Visit `/boss-scents` → new comp plan copy renders, no `<undefined>` blanks or broken layouts.
- Run `grep -i 'downline\|recruit\|MLM' src/app/(public)/` post-edit — should return zero customer-facing hits.

### Verification commands (commit-ready)

```bash
npx tsc --noEmit
npm test
npm run build
git status   # confirm only expected files
git diff --stat
```

---

## 5. Risks

1. **Stale internal links.** Some component may link to `/account/distributor` via a string literal I miss. Mitigation: `grep -rn "/distributors\|/account/distributor" src/` after the renames.
2. **Sponsor cookie path.** If middleware writes the cookie with `path=/r` or `path=/distributors`, the rename breaks the cookie. Mitigation: read `src/middleware.ts` carefully, default cookie path is `/` per Set-Cookie convention.
3. **SEO loss.** 301 redirects preserve PageRank but the URL changes invalidate cached share URLs. Mitigation: 301 (not 302), redirect block in `next.config.js`. Negligible impact for a site that's not yet live to real customers.
4. **Tests breaking on renamed paths.** Check `tests/unit/` for any string literal references to `/distributors` or `/account/distributor`.
5. **Migrations 021/022 already touched the schema.** This is unrelated to Phase 1 (already shipped), but worth flagging that the schema is mid-flight; Phase 2 will need to consider migration 021's `expired` enum value and 022's `webhook_deliveries` columns when authoring its own migrations.

---

## 6. What I need from the owner before starting

- **Confirm:** start Phase 1 now under this plan, or any edits to the vocabulary table / file list / rank mapping?
- **One-shot decision:** is the redirect block in `next.config.js` (above) acceptable, or do you want path-preserving rewrites instead of redirects?
- **Tier badge styling:** the dashboard currently shows a rank emoji + name. The new tier system has 4 tiers — want me to introduce a small tier-badge component, or keep displaying the underlying rank in Phase 1?

If you reply "go", I execute as above. If anything in §1's vocabulary table is wrong, fix it here before I touch a file.
