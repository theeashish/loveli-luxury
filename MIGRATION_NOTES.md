# MIGRATION_NOTES — Loveli Luxury transformation, Phase 2 schema work

> ⚠️ **SUPERSEDED in part — read this before §1.** The 8 → 4 tier collapse described in §1 was **not adopted**. After owner review the team kept the **5-rank v1 model** (`ambassador → executive → gold_director → platinum_director → diamond_director` per `src/lib/partners/tiers.ts`) and the matching v1 SQL config tables (`config_ranks`, `config_commission_rates`, `config_salary_tiers`). The v2 scaffolding referenced below was removed; live commission math is the **5-rank L1–L5 PV plan** in production (migrations 029 / 036 / 040). The terminology renames in **§2–§4** (`monthly_salaries → retention_bonus_grants`, `gsv_snapshots → revenue_snapshots`, `is_starter_package → is_onboarding_kit`, `distributors → partners`) remain valid Phase-2 work if/when the owner approves.
>
> Last superseded check: 2026-06-03.

---

**Status:** Proposal only. **No destructive migrations ship in Phase 1.** This document is the spec Phase 2 (Compensation Plan Restructure) will execute — **subject to the supersession note above.**

**Sign-off scope:** This document was produced as part of Phase 1 (Terminology & Positioning Refactor) per §5 of the transformation prompt: "Where database columns use MLM language, produce a migration plan but do not run destructive migrations yet — propose, wait for approval." The owner reviews and approves; Phase 2 then runs.

---

## 1. Rank collapse — 8 internal ranks → 4 customer-facing tiers

### 1.1 Naming (locked 2026-05-18)

| Tier position | Customer-facing name | Earnings (per brand brief) |
|---|---|---|
| 1 | Concierge Partner | 10% direct, no override, no recruitment rights |
| 2 | Brand Associate | 15% direct + 3% override on Concierge Partners |
| 3 | Regional Curator | 20% direct + tiered team override |
| 4 | Prestige Partner | 20% + luxury bonuses + event access + regional rights + limited-edition allocation |

### 1.2 8 → 4 transitional bridge mapping

For distributors who exist at the time Phase 2 ships, their `current_rank_id` (1..8 in `config_ranks`) maps into a `current_tier_id` (1..4 in the new `config_partner_tiers`) as follows:

| Current rank | Position | New tier |
|---|---|---|
| Team Builder | 1 | Concierge Partner |
| Team Leader | 2 | Concierge Partner |
| Supervisor | 3 | Brand Associate |
| Manager | 4 | Brand Associate |
| Senior Manager | 5 | Regional Curator |
| Executive Manager | 6 | Regional Curator |
| Legacy Builder | 7 | Prestige Partner |
| Ambassador | 8 | Prestige Partner |

This is a one-time backfill executed inside the Phase 2 migration. After the migration runs, NEW signups land directly in `current_tier_id = 1` (Concierge Partner) and progress per §6.1 of the transformation prompt (rolling 90-day verified retail sales + retention score + content output).

### 1.3 Proposed schema for Phase 2

```sql
-- NEW: 4-tier config table (replaces config_ranks for new logic)
CREATE TABLE partner_tiers (
  id                          BIGSERIAL PRIMARY KEY,
  tier_position               INT NOT NULL CHECK (tier_position BETWEEN 1 AND 4) UNIQUE,
  tier_code                   TEXT NOT NULL UNIQUE,            -- 'concierge_partner' etc.
  display_name                TEXT NOT NULL,                   -- 'Concierge Partner'
  direct_rate_basis_points    INT NOT NULL,                    -- 1000 / 1500 / 2000 / 2000
  override_rate_basis_points  INT NOT NULL DEFAULT 0,          -- 0 / 300 / 0 (varies) / 0
  can_refer_tier_max          INT NOT NULL DEFAULT 0,          -- 0 / 1 / 2 / 4
  qualification_rules         JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE distributors
  ADD COLUMN current_tier_id BIGINT REFERENCES partner_tiers(id);

-- Rolling-90-day qualification view, refreshed by the monthly close cron
CREATE MATERIALIZED VIEW partner_qualifications AS
  SELECT
    d.id AS distributor_id,
    COALESCE(SUM(oi.commissionable_amount_minor) FILTER (
      WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
    ), 0) AS verified_revenue_90d_minor,
    -- … additional metrics: retention_score, repeat_customers_90d, content_posts_30d, etc.
    NOW() AS computed_at
    FROM distributors d
    LEFT JOIN orders o ON o.sponsor_distributor_id = d.id
    LEFT JOIN order_items oi ON oi.order_id = o.id
   GROUP BY d.id;
```

The `current_rank_id` column (8-rank scheme) stays on `distributors` during the transition for legacy audit. Once all reporting + UI is on `current_tier_id`, `current_rank_id` can be dropped in a follow-up migration. Don't drop in Phase 2 — defer to a clean follow-up.

### 1.4 Compensation calculation switch

`write_commission_ledger(order_id)` (currently in migration `004` + extended in `009` + `013`) needs a Phase-2 rewrite that:
- Reads from `partner_tiers` instead of `config_commission_rates`.
- Walks the closure tree only up to the recipient's `can_refer_tier_max` depth.
- Enforces §6.2 hard rules (no payout without verified paid non-refunded order; no recruitment-only qualification).

The old RPC stays callable but logs a deprecation warning. The cutover is a single env-var flag — `COMPENSATION_ENGINE=v2` — flipped after Phase 2 backfill + reconciliation.

---

## 2. `monthly_salaries` → `retention_bonus_grants`

Per §6.3 of the transformation prompt: "Performance retention bonus replaces 'lifetime salary'. Must be tied to a configurable list of target metrics, reviewed quarterly via admin-approved batch, never a database default, always an explicit `bonus_grant` row tied to a review period."

### 2.1 Proposed Phase 2 migration

```sql
ALTER TABLE monthly_salaries RENAME TO retention_bonus_grants;

ALTER TABLE retention_bonus_grants RENAME COLUMN fixed_salary_minor TO base_grant_minor;
ALTER TABLE retention_bonus_grants RENAME COLUMN performance_bonus_minor TO performance_grant_minor;

ALTER TABLE retention_bonus_grants
  ADD COLUMN reviewer_id        UUID REFERENCES profiles(id),
  ADD COLUMN review_period_quarter TEXT,        -- '2026Q2' etc.
  ADD COLUMN review_metrics     JSONB,           -- snapshot of target metrics at review time
  ADD COLUMN review_decision    TEXT,            -- 'granted' | 'denied' | 'reduced'
  ADD COLUMN review_notes       TEXT;

-- Rename the period_year/period_month columns to make quarterly grants natural;
-- keep them populated for legacy audit. Add a constraint that future grants
-- must include review_period_quarter.
ALTER TABLE retention_bonus_grants
  ADD CONSTRAINT retention_bonus_quarterly_or_legacy
    CHECK (review_period_quarter IS NOT NULL
           OR (period_year IS NOT NULL AND period_month IS NOT NULL));
```

### 2.2 RPC rewrites

- `compute_monthly_salary` (migration `006`) — superseded by an admin-triggered quarterly batch action. The cron-fired RPC stays as a deprecated shim during the cutover but writes to `audit_log` rather than inserting bonus rows.
- A new admin server-action `previewQuarterlyRetentionBonuses(year, quarter)` aggregates eligibility per the new `review_metrics`. Admin reviews the list, approves selected rows, and the approval inserts `retention_bonus_grants` rows tied to the approving `reviewer_id`. This is the §6.2 "must be admin-approved batch, never a database default" requirement.

### 2.3 Backfill / migration

Existing `monthly_salaries` rows become legacy `retention_bonus_grants` rows with `review_decision = NULL` and `reviewer_id = NULL`. Admin can backfill historical reviewer attribution as needed. No row deletions in the migration — historical payouts must remain reconcilable.

---

## 3. Other rename candidates

### 3.1 Tables and columns flagged from copy audit

| Current | Proposed | Reason | Phase to execute |
|---|---|---|---|
| `gsv_snapshots` | `revenue_snapshots` | "GSV" is MLM-coded ("Group Sales Volume"). Rename to plain language. | Phase 2 |
| `commission_ledger.basis_pv` | keep | Internal column, customer never sees. PV math survives internally. | — |
| `product_variants.pv_per_bottle` | keep | Internal. Same rationale. | — |
| `bundles.is_starter_package` | `bundles.is_onboarding_kit` | Aligns with "Onboarding kit" public copy. Low-risk rename. | Phase 2 |
| `bundles.starter_package_code` | `bundles.onboarding_kit_code` | Same. | Phase 2 |
| `config_starter_packages` | `config_onboarding_kits` | Same. | Phase 2 |
| `orders.kind` enum value `distributor_signup` | `partner_signup` | Customer-facing through the order detail page. | Phase 2 |
| `orders.kind` enum value `distributor_restock` | `partner_restock` | Same. | Phase 2 |
| `user_roles.role` enum value `distributor` | `partner` | Spans RBAC checks; needs careful migration with RLS policy updates. | Phase 2 (highest-risk rename in this list — execute LAST) |
| `distributors` table itself | `partners` | Largest rename. Spans every FK, every RLS policy, every RPC. **Highest risk.** | Phase 2 (or possibly defer to a later phase if Phase 2 is already too dense) |
| `distributor_tree` | `partner_tree` | Same. | Same phase as `distributors`. |
| `distributors.sponsor_code` | keep | "Sponsor" is acceptable luxury vocabulary. | — |
| `distributors.sponsor_id` | keep | Same. | — |
| `commission_ledger.level` | keep | Internal. | — |

### 3.2 What's NOT being renamed (deliberate)

- **Schema enums for `order_status`** — `pending / paid / failed / cancelled / fulfilled / shipped / delivered / refunded / expired` are domain-neutral. Don't touch.
- **All RLS policy names** — internal. Don't touch.
- **Admin URL slugs** (`/admin/comp/starter-packages`, etc.) — refactor in a later phase if at all; admins live with internal terminology.
- **Migration files' SQL identifiers** — historical migrations are immutable; new migrations use the new names.

---

## 4. Migration ordering for Phase 2

To minimize disruption:

1. **Add new tables alongside the old.** Don't drop anything in the same migration.
2. **Dual-write period.** Both `current_rank_id` and `current_tier_id` get maintained for at least one monthly close so reporting can be cross-checked.
3. **Backfill old rows.** Run a one-shot script (NOT a migration) to populate `current_tier_id` from `current_rank_id` per §1.2.
4. **Cut over RPCs behind a feature flag.** `COMPENSATION_ENGINE=v2` env var; flip in production only after staging dry-run.
5. **Drop legacy columns only after** the next monthly close + payout cycle confirms zero reconciliation drift.

Estimated migration count for Phase 2: **8–12 migration files** (one per logical step + the data backfill scripts as separate `*_data.sql` migrations).

---

## 5. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| `mark_order_paid → provision_distributor → write_commission_ledger` chain breaks during cutover | **Critical** | Dual-write + feature flag, never delete the old RPC during the migration window. |
| RLS policies on `distributors` table break when renamed | **High** | The table rename to `partners` should be a LATER migration after every dependent policy is rewritten and dry-run. Or defer the table rename entirely. |
| Payout calculations diverge between old and new engines | **High** | Side-by-side comparison job runs for one full monthly close before flag flip; any drift halts the cutover. |
| Existing distributors lose their `current_rank_id` audit history | Medium | Don't drop the column; keep for legacy audit indefinitely. |
| External `/distributors/*` URLs return 404 after slug rename | Medium | 301 redirects in `next.config.js` shipped as part of Phase 1 (already done). |
| `users.role = 'distributor'` references break across RBAC + RLS | **High** | Defer enum-value rename to its own follow-up phase. Mass-update all RLS policies in one migration with a rollback path. |
| Admin payout queue UI breaks during `monthly_salaries` → `retention_bonus_grants` rename | Medium | Rename via PostgreSQL `RENAME` (preserves all FKs / indexes); update all `.from('monthly_salaries')` references in app code in the same PR. |

---

## 6. Out of scope for Phase 2

- Visual / UI rework — that's Phase 3.
- Trust infrastructure (WhatsApp concierge, policy pages, video reviews) — Phase 4.
- Performance work — Phase 5.
- The §10 content engine (journal, academy, guides) — separate track.

---

## 7. Open questions for Phase 2 sign-off

To be confirmed before Phase 2 migration code is written:

1. **Confirm the `distributors` → `partners` table rename is in or out of Phase 2?** It's the highest-risk single change in the entire transformation. Could be deferred to its own phase with a longer cutover window.
2. **Confirm the `users.role` enum rename `distributor → partner` is in or out of Phase 2?** Same rationale.
3. **Confirm the new tier qualification rules from §6.1** of the transformation prompt are the final spec, or want adjustments to thresholds (default KES 30,000 monthly retail; retention ≥ 0.6; ≥ 10 repeat customers; ≥ 4 verified posts/month)?
4. **Confirm the retention bonus quarterly cadence** is the right cadence (vs monthly, vs annually)?
5. **Confirm whether the §6.4 fraud rules** (KYC gating above KES 5,000, velocity checks, self-referral detection, refund propagation) all ship in Phase 2 or split across Phase 2 + Phase 4?
