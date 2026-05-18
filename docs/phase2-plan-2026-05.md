# Phase 2 plan — Compensation Plan Restructure

**Reference:** §6 of the original transformation prompt + [MIGRATION_NOTES.md](../MIGRATION_NOTES.md) + the brand brief.

Phase 2 is the highest-risk phase in the entire transformation: it rewrites the compensation engine, renames tables that are referenced by FKs across the schema, and touches the money-movement path. To make this shippable and reviewable, the phase splits into **four sub-phases** (2a → 2d), each independently deployable. **Each sub-phase needs its own approval before code starts.**

This document is the §11.1 plan. No source files are modified until the owner approves a specific sub-phase.

---

## Scope at a glance

| Sub-phase | Risk | Touches money path? | Effort | Suggested first session |
|---|---|---|---|---|
| **2a — Additive tier schema + display** | LOW | No (engine flag stays off) | Medium | ✅ Yes |
| **2b — Engine v2 + cutover** | HIGH | Yes (payout math) | Large | After 2a + 1 monthly close |
| **2c — Renames + fraud/integrity** | MEDIUM | Indirectly (clawback flow) | Medium | After 2b stable |
| **2d — Distributors → partners table rename** | CRITICAL | Yes (RLS, FKs, RPCs all rewritten) | Large | Defer — own session, dedicated dry-run |

Phase 2 is **never** "done in one push". Each sub-phase ships, gets a monthly close cycle to bake, then the next ships.

---

## Phase 2a — Additive tier schema + display layer

**Goal:** introduce the 4-tier data model alongside the existing 8-rank one. No destructive changes; no payout math touched. The display layer already uses `partnerTierForRank` (shipped in Phase 1); after 2a the display layer can switch to `current_tier_id` directly when the engine flag flips in 2b.

### 2a — Schema migration

New migration: `supabase/migrations/023_partner_tiers.sql`

```sql
-- 1. partner_tiers config table
CREATE TABLE partner_tiers (
  id                          BIGSERIAL PRIMARY KEY,
  tier_position               INT NOT NULL CHECK (tier_position BETWEEN 1 AND 4) UNIQUE,
  tier_code                   TEXT NOT NULL UNIQUE,
  display_name                TEXT NOT NULL,
  direct_rate_basis_points    INT NOT NULL,
  override_rate_basis_points  INT NOT NULL DEFAULT 0,
  can_refer_tier_max          INT NOT NULL DEFAULT 0,
  -- Qualification rules from §6.1 of the transformation prompt.
  -- Stored as JSONB so finance can tune thresholds without a deploy.
  qualification_rules         JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 4 tiers per the brand brief.
INSERT INTO partner_tiers (tier_position, tier_code, display_name,
  direct_rate_basis_points, override_rate_basis_points, can_refer_tier_max,
  qualification_rules) VALUES
  (1, 'concierge_partner', 'Concierge Partner', 1000, 0, 0,
   '{"requires": ["verified_customer_or_creator"]}'),
  (2, 'brand_associate',   'Brand Associate',   1500, 300, 1,
   '{"min_monthly_retail_minor": 3000000, "min_retention_score": 0.6}'),
  (3, 'regional_curator',  'Regional Curator',  2000, 0, 2,
   '{"min_repeat_customers": 10, "min_posts_per_month": 4,
     "min_monthly_retail_minor": 10000000}'),
  (4, 'prestige_partner',  'Prestige Partner',  2000, 0, 4,
   '{"quarterly_review_required": true, "brand_compliance_required": true}');

-- 2. distributors.current_tier_id — nullable until backfill completes
ALTER TABLE distributors
  ADD COLUMN current_tier_id BIGINT REFERENCES partner_tiers(id);

CREATE INDEX idx_distributors_current_tier
  ON distributors (current_tier_id)
  WHERE current_tier_id IS NOT NULL;

-- 3. partner_qualifications materialized view (rolling 90-day metrics).
--    Refreshed by the monthly close cron + admin trigger. Read-only for
--    everyone except the refresh actor.
CREATE MATERIALIZED VIEW partner_qualifications AS
SELECT
  d.id AS distributor_id,
  COALESCE(SUM(oi.commissionable_amount_minor) FILTER (
    WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
  ), 0) AS verified_revenue_90d_minor,
  COUNT(DISTINCT o.user_id) FILTER (
    WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
  ) AS unique_buyers_90d,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
  ) AS paid_orders_90d,
  -- Retention score = repeat-buyer ratio over 90 days, 0..1.
  CASE
    WHEN COUNT(DISTINCT o.user_id) FILTER (
      WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
    ) = 0 THEN 0
    ELSE COUNT(DISTINCT o.user_id) FILTER (
      WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
        AND o.user_id IN (
          SELECT user_id FROM orders o2
          WHERE o2.sponsor_distributor_id = d.id
            AND o2.status = 'paid'
            AND o2.paid_at < NOW() - INTERVAL '90 days'
        )
    )::numeric / NULLIF(COUNT(DISTINCT o.user_id) FILTER (
      WHERE o.status = 'paid' AND o.paid_at > NOW() - INTERVAL '90 days'
    ), 0)
  END AS retention_score_90d,
  NOW() AS computed_at
  FROM distributors d
  LEFT JOIN orders o ON o.sponsor_distributor_id = d.id
  LEFT JOIN order_items oi ON oi.order_id = o.id
 GROUP BY d.id;

CREATE UNIQUE INDEX idx_partner_qualifications_distributor
  ON partner_qualifications (distributor_id);

-- 4. Backfill: map every existing distributor's current_rank_id (1..8) to
--    the appropriate current_tier_id (1..4) via the Phase-1 bridge.
WITH bridge AS (
  SELECT cr.id AS rank_id, cr.rank_position,
    CASE
      WHEN cr.rank_position <= 2 THEN 1
      WHEN cr.rank_position <= 4 THEN 2
      WHEN cr.rank_position <= 6 THEN 3
      ELSE 4
    END AS tier_position
  FROM config_ranks cr WHERE cr.effective_until IS NULL
)
UPDATE distributors d SET current_tier_id = (
  SELECT pt.id FROM partner_tiers pt
   WHERE pt.tier_position = (
     SELECT b.tier_position FROM bridge b WHERE b.rank_id = d.current_rank_id
   )
)
WHERE d.current_rank_id IS NOT NULL;

-- 5. RLS on the new table + materialized view
ALTER TABLE partner_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_tiers_read ON partner_tiers FOR SELECT USING (effective_until IS NULL);
CREATE POLICY partner_tiers_write ON partner_tiers FOR ALL
  USING (has_role('superadmin'));
```

### 2a — RPCs

New RPCs (in a separate migration `024_tier_rpcs.sql`):
- `compute_partner_qualifications(partner_id BIGINT)` — pure function returning the latest qualification row for a single partner. Used by the admin tier-management page.
- `refresh_partner_qualifications()` — `REFRESH MATERIALIZED VIEW CONCURRENTLY partner_qualifications`. Called by the monthly close cron and the admin "Recompute now" button.
- `evaluate_partner_tier(partner_id BIGINT)` — given current_tier_id and the latest qualification row, return one of `'hold' | 'advance' | 'downgrade_warn' | 'downgrade'`. Used by Phase 2b's quarterly review.

### 2a — App / UI

- New helper `src/lib/partners/qualification.ts` — typed wrapper around `compute_partner_qualifications` RPC.
- Update `src/lib/partners/tiers.ts` — read display-name from DB instead of hard-coded const? No — keep hard-coded for now (UI doesn't depend on DB read). Phase 2b switches to DB-read.
- Admin page `/admin/comp/tiers` (new) — list the 4 tier rows, show their qualification rules, allow superadmin edit. Audit-logged versioned writes (effective_from / effective_until pattern, same as `config_starter_packages`).
- Admin page `/admin/comp/partner-qualifications` (new) — per-partner read view: current tier, latest 90-day metrics, evaluation outcome.
- No changes to: any payout path, `write_commission_ledger`, `compute_monthly_salary`, anything user-facing besides the admin pages.

### 2a — Tests

- `tests/unit/partner-tiers-seed.test.ts` — assert the seed values match the brand brief (10%, 15+3%, 20%, 20+bonuses).
- `tests/unit/partner-qualification.test.ts` — pure-function tests on the JS-side `evaluatePartnerTier(qualificationRow, tierRule)` decision logic. The SQL function is just a thin wrapper.
- Integration test for the backfill migration: run on a temp DB with seed data, assert every distributor lands in the right tier.

### 2a — Verification + rollback

- `npx tsc --noEmit`, `npm test`, `npm run build` all green
- Apply migrations 023 + 024 in Supabase SQL editor
- Verify backfill via `SELECT current_tier_id, COUNT(*) FROM distributors GROUP BY current_tier_id;`
- Verify the materialized view via `SELECT * FROM partner_qualifications LIMIT 10;`
- Rollback: drop `current_tier_id` column, drop the view, drop the table. All additive — no data lost.

### 2a — Owner-facing impact

**Zero.** No payout math change, no UI vocabulary change, no flag flipped. The user can poke at `/admin/comp/tiers` and `/admin/comp/partner-qualifications` to see the new data — that's the only visible difference.

This is the safe sub-phase to ship first.

---

## Phase 2b — Compensation engine v2 + cutover

**Goal:** introduce the new tier-based compensation engine alongside the existing rank-based one. Flag-gated. Both engines compute side-by-side for one monthly close. Then flip.

### 2b — App layer

- `src/lib/payments/compensation-engine.ts` (new) — the engine interface:
  ```ts
  interface CompensationEngine {
    name: 'v1_rank' | 'v2_tier'
    computeForOrder(orderId: number): Promise<CommissionRow[]>
  }
  ```
- `src/lib/payments/engine-v1-rank.ts` — wraps the existing `write_commission_ledger` RPC.
- `src/lib/payments/engine-v2-tier.ts` — new implementation:
  - Reads `partner_tiers` for rate/override settings.
  - Walks `distributor_tree` only up to `can_refer_tier_max` depth.
  - Enforces §6.2 hard rules: requires order status `paid`, refuses to write commission if buyer's sponsor has zero personal sales in 90 days, refuses if sponsor's `current_tier_id` is null.
  - Writes to `commission_ledger` with `compensation_engine = 'v2'` (new column from migration 025 below).
- `src/lib/payments/dispatcher.ts` — already supports the dispatch pattern; add an `engine` field to `InitiatePaymentResult` if useful.
- Env flag: `COMPENSATION_ENGINE` — `'v1_rank' | 'v2_tier' | 'both'`. Default `'v1_rank'`. `'both'` runs both engines and writes to `commission_ledger_v2_preview` (new staging table) for side-by-side comparison.

### 2b — Schema additions

`supabase/migrations/025_engine_v2_staging.sql`:
- Add `commission_ledger.compensation_engine TEXT NOT NULL DEFAULT 'v1_rank'`
- Add `commission_ledger.tier_at_time_id BIGINT REFERENCES partner_tiers(id)` — captured at write time per §6.3
- Create `commission_ledger_v2_preview` table — same shape as `commission_ledger` but for dry-run output during the side-by-side window. Truncate-and-rewrite, not append.

### 2b — Quarterly retention bonus admin UI

Brand brief §6.3 + transformation prompt §6.3: replace `monthly_salaries` cron-fired insert with an admin-approved quarterly batch.

- New admin page `/admin/comp/retention-bonuses/new`:
  - Pick quarter (e.g. 2026 Q2)
  - Server action `previewQuarterlyRetentionBonuses(year, quarter)` returns the list of eligible partners with their qualification metrics
  - Admin checkboxes which to grant + amount per partner (defaulting to the tier's standard grant)
  - Submit creates rows in `retention_bonus_grants` (renamed from `monthly_salaries` in Phase 2c — until then writes to `monthly_salaries` with an extra `review_period_quarter` column added in this migration)
- Audit-logged with reviewer_id

### 2b — Dry-run + cutover

1. Apply 025. `COMPENSATION_ENGINE` stays `'v1_rank'`. Site behaviour unchanged.
2. Set `COMPENSATION_ENGINE='both'` on staging. Verify `commission_ledger_v2_preview` shows expected output across the last 30 days of orders.
3. Run the monthly close. Compare v1 ledger vs v2 preview rows. Reconcile any drift.
4. Once one full monthly close shows zero drift on edge cases: flip `COMPENSATION_ENGINE='v2_tier'` on production. v1 RPC stays callable but emits a deprecation warning to audit_log.
5. After 30 days of v2 stable: archive `commission_ledger_v2_preview`.

### 2b — Tests

- `tests/unit/engine-v2-tier.test.ts` — table-driven cases covering: Concierge → Brand Associate boundary, override depth caps, the §6.2 hard rules (no payout without verified order, no recruitment-only qualification, no rank retention without sales).
- `tests/unit/quarterly-bonus-eligibility.test.ts` — pure function tests.
- Integration test: snapshot the v1 output for a fixture order chain, snapshot the v2 output, assert the documented intentional differences (different rates, different depth caps) and otherwise zero drift.

### 2b — Verification + rollback

- After dry-run period, flip flag in prod. Watch logs for 7 days.
- Rollback: set `COMPENSATION_ENGINE='v1_rank'`. v2-written commission rows tagged with `compensation_engine = 'v2'` get a separate decision: either pay them out (treat as authoritative) or void via `void_unpaid_commissions_*`. Decision is admin-only; document in the migration's runbook.

---

## Phase 2c — Renames + fraud/integrity rules

**Goal:** rename the legacy-vocabulary tables/columns that are safe to rename. Implement §6.4 fraud rules.

### 2c — Renames (safe set)

`supabase/migrations/026_phase2c_renames.sql`:
- `ALTER TABLE monthly_salaries RENAME TO retention_bonus_grants`
- `ALTER TABLE retention_bonus_grants RENAME COLUMN fixed_salary_minor TO base_grant_minor`
- `ALTER TABLE retention_bonus_grants RENAME COLUMN performance_bonus_minor TO performance_grant_minor`
- Add `retention_bonus_grants.reviewer_id UUID REFERENCES profiles(id)`
- Add `retention_bonus_grants.review_period_quarter TEXT`
- Add `retention_bonus_grants.review_metrics JSONB`
- Add `retention_bonus_grants.review_decision TEXT`
- Add `retention_bonus_grants.review_notes TEXT`
- `ALTER TABLE gsv_snapshots RENAME TO revenue_snapshots`
- `ALTER TABLE config_starter_packages RENAME TO config_onboarding_kits`
- `ALTER TABLE bundles RENAME COLUMN is_starter_package TO is_onboarding_kit`
- `ALTER TABLE bundles RENAME COLUMN starter_package_code TO onboarding_kit_code`
- Update every `.from('monthly_salaries')`, `.from('gsv_snapshots')`, `.from('config_starter_packages')` reference in `src/`
- Update `src/types/database.ts` via `supabase gen types`

Order_kind enum values are LEFT alone in 2c — that change requires updating every `eq('kind', 'distributor_signup')` reference. Done as part of 2d (paired with the distributors → partners rename for atomicity).

### 2c — Fraud / integrity (§6.4)

New module `src/lib/fraud/`:
- `kyc-gate.ts` — `assertKycForPayout(partnerId, amountMinor)` — throws if partner has no completed KYC and amount > `PAYOUT_KYC_THRESHOLD_MINOR` (env, default `500000` = Kes 5,000).
- `velocity-check.ts` — `flagRapidReferrals(partnerId)` — flags partner whose new-referral count > N per week (default 10, env-configurable).
- `self-referral-detect.ts` — `checkSelfReferral({ ipHash, msisdn, deviceFingerprint })` — on partner signup, compare against existing partners. Flag is written to `partner_flags` table (new), not used to auto-block.

Refund propagation already exists (`void_unpaid_commissions_for_order` from migration 008). Verify it now flips commission rows tagged `compensation_engine='v2'` correctly.

### 2c — Schema additions

`supabase/migrations/027_fraud_flags.sql`:
- `partner_flags` table: `partner_id`, `flag_type`, `flag_data JSONB`, `flagged_at`, `resolved_at`, `resolver_id`, `resolution_notes`.

### 2c — Verification

- All renamed tables: `SELECT 1 FROM <new_name>` works; `SELECT 1 FROM <old_name>` errors with "relation does not exist" (proves the rename took, not a copy).
- Run tests; all should pass (no behaviour change beyond names).
- KYC + velocity + self-referral checks: integration tests with seeded data.

---

## Phase 2d — Highest-risk renames (defer)

**Defer to a dedicated session.** These are the renames that ripple through RLS policies, FKs, RPCs, and middleware:

- `distributors` table → `partners`
- `distributor_tree` → `partner_tree`
- `user_roles.role` enum value `distributor` → `partner`
- `orders.kind` enum value `distributor_signup` → `partner_signup`
- `orders.kind` enum value `distributor_restock` → `partner_restock`
- `commission_ledger.distributor_id` → `commission_ledger.partner_id`
- `commission_ledger.source_distributor_id` → `commission_ledger.source_partner_id`
- `orders.sponsor_distributor_id` → `orders.sponsor_partner_id`

Each of these renames touches every RLS policy that references the column, every RPC that joins on it, every `from('distributors')` in `src/`, and every `auth.uid()`-based check. Pattern for 2d:
1. Add the new column as a generated alias (`GENERATED ALWAYS AS (distributor_id) STORED`) that the new code reads from.
2. Rewrite all RLS policies + RPCs to reference both names during the transition.
3. After one full monthly close + payout cycle on dual-references, drop the alias and rename the actual column.
4. Update all app-layer `.from('distributors')` → `.from('partners')` etc.

Estimated 8-12 migration files just for 2d. **Own session, own dry-run, own rollback plan.**

---

## Open questions before any sub-phase ships

These need owner answers before any of the above runs:

1. **Tier 1 qualification.** §6.1 says "Verified content creator OR verified customer". What's the criterion for "verified content creator" — manual admin approval, an Instagram/TikTok handle linked, follower count threshold? **Default proposal:** an admin approves a `content_creator_application` row after the partner submits their socials. Until approved, partner is qualified as "verified customer" if they have ≥1 paid retail order.

2. **Brand Associate qualification thresholds.** §6.1 default is Kes 30,000 monthly verified retail sales + retention score ≥ 0.6. The 90-day window in `partner_qualifications` divides Kes 30k/month roughly into Kes 90k/90d. **Confirm:** Kes 30k/month is the per-month threshold (so 90-day window threshold is Kes 90k), or the 90-day window threshold is Kes 30k directly?

3. **Retention score formula.** The proposed formula in 2a's materialized view is "repeat buyers in last 90d / unique buyers in last 90d". Acceptable, or want a different definition (e.g. "repeat-purchase rate over rolling 180d")?

4. **KYC threshold for payouts.** Default Kes 5,000 (500,000 minor). Confirm or change.

5. **Velocity threshold.** Default: flag any partner with > 10 new referrals per week. Confirm or change.

6. **What happens to partners who drop below their tier minimum?** §6.2 says 30-day grace + warning, then downgrade. **Question:** downgrade to the immediately-lower tier, or skip-downgrade if their metrics map to two-tiers-down? **Default proposal:** always one tier down per quarterly review.

7. **Compensation engine flag default during 2b.** Default proposal: `'v1_rank'` (no behaviour change) until the side-by-side dry-run passes. Confirm.

8. **distributors → partners table rename — defer or include in 2c?** Default proposal: defer to 2d. Confirm. (Doing it in 2c is possible but materially expands scope and risk.)

---

## Suggested execution order

If you green-light everything: **2a → bake 1 monthly close → 2b → bake 1 monthly close → 2c → defer 2d**.

Total elapsed time at a typical monthly cadence: roughly 3 months from start to "Phase 2 complete (2a–2c)". That sounds long, but the alternative — shipping the compensation engine in one shot — is how payout incidents happen. The brand brief itself flagged "payout pressure" and "regulatory scrutiny" as core risks; this pacing is the answer to those risks.

---

## What I need from the owner

- Answers to the 8 open questions above (most have safe defaults — say "use the defaults" if no preference).
- Pick which sub-phase to scope first for execution: **2a alone** (recommended for this session), or **2a + 2b plan only** (split delivery), or something else.
- Confirm the deferral of 2d.
