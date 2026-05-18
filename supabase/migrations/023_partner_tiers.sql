-- 023_partner_tiers.sql
--
-- Phase 2a — additive tier schema layer for the Compensation Plan
-- Restructure. NO destructive changes to existing rank-based tables.
-- The compensation engine stays on v1_rank (the existing
-- write_commission_ledger RPC) until Phase 2b explicitly flips it.
--
-- What this adds:
--   1. partner_tiers       — configurable 4-tier ladder (versioned via
--                            effective_from/effective_until pattern,
--                            same shape as config_starter_packages).
--   2. distributors.current_tier_id  — nullable FK pointing at the
--                                       partner the distributor maps to.
--   3. partner_qualifications  — materialized view computing each
--                                distributor's rolling 90-day verified
--                                retail metrics + retention score.
--   4. A backfill that maps every existing distributor's current_rank_id
--      (1..8) to the appropriate current_tier_id (1..4) via the Phase-1
--      bridge: ranks 1-2 → tier 1, 3-4 → tier 2, 5-6 → tier 3, 7-8 → tier 4.
--
-- Idempotent.  Safe to re-run.

-- ---------------------------------------------------------------------
-- 1. partner_tiers — config table
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS partner_tiers (
  id                           BIGSERIAL    PRIMARY KEY,
  tier_position                INT          NOT NULL CHECK (tier_position BETWEEN 1 AND 4),
  tier_code                    TEXT         NOT NULL,
  display_name                 TEXT         NOT NULL,
  -- Earnings in basis points (1 bp = 0.01%). 1000 = 10%.
  direct_rate_basis_points     INT          NOT NULL CHECK (direct_rate_basis_points BETWEEN 0 AND 10000),
  override_rate_basis_points   INT          NOT NULL DEFAULT 0 CHECK (override_rate_basis_points BETWEEN 0 AND 10000),
  -- Max tier_position the partner is allowed to refer/invite.
  -- 0 = cannot refer anyone, 1 = can only refer tier-1, etc.
  can_refer_tier_max           INT          NOT NULL DEFAULT 0 CHECK (can_refer_tier_max BETWEEN 0 AND 4),
  -- Qualification rule blob — finance/admin tunes thresholds without
  -- a deploy. Shape documented in src/lib/partners/tier-evaluator.ts.
  qualification_rules          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  effective_from               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  effective_until              TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Exactly one active row per tier_position at any time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_tiers_position_active
  ON partner_tiers (tier_position)
  WHERE effective_until IS NULL;

-- Tier code lookups (e.g. 'brand_associate') from app layer.
CREATE INDEX IF NOT EXISTS idx_partner_tiers_code
  ON partner_tiers (tier_code);

-- Seed the 4 tiers — only if no active rows exist yet (idempotent).
INSERT INTO partner_tiers (
  tier_position, tier_code, display_name,
  direct_rate_basis_points, override_rate_basis_points, can_refer_tier_max,
  qualification_rules
)
SELECT *
  FROM (VALUES
    (1, 'concierge_partner', 'Concierge Partner',
     1000, 0, 0,
     jsonb_build_object(
       'requires_any', jsonb_build_array(
         'verified_content_creator',
         'verified_customer'
       )
     )),
    (2, 'brand_associate', 'Brand Associate',
     1500, 300, 1,
     jsonb_build_object(
       'min_90d_retail_minor',  9000000,
       'min_retention_score',   0.6
     )),
    (3, 'regional_curator', 'Regional Curator',
     2000, 0, 2,
     jsonb_build_object(
       'min_90d_retail_minor',  30000000,
       'min_unique_buyers_90d', 10,
       'min_90d_post_count',    12
     )),
    (4, 'prestige_partner', 'Prestige Partner',
     2000, 0, 4,
     jsonb_build_object(
       'min_90d_retail_minor',          60000000,
       'quarterly_review_required',     true,
       'brand_compliance_required',     true
     ))
  ) AS s(
    tier_position, tier_code, display_name,
    direct_rate_basis_points, override_rate_basis_points, can_refer_tier_max,
    qualification_rules
  )
 WHERE NOT EXISTS (
   SELECT 1 FROM partner_tiers
    WHERE tier_position = s.tier_position
      AND effective_until IS NULL
 );

ALTER TABLE partner_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS partner_tiers_read ON partner_tiers;
CREATE POLICY partner_tiers_read ON partner_tiers
  FOR SELECT
  USING (effective_until IS NULL);

DROP POLICY IF EXISTS partner_tiers_write ON partner_tiers;
CREATE POLICY partner_tiers_write ON partner_tiers
  FOR ALL
  USING (has_role('superadmin'))
  WITH CHECK (has_role('superadmin'));

-- ---------------------------------------------------------------------
-- 2. distributors.current_tier_id — nullable; backfilled below
-- ---------------------------------------------------------------------

ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS current_tier_id BIGINT REFERENCES partner_tiers(id);

CREATE INDEX IF NOT EXISTS idx_distributors_current_tier
  ON distributors (current_tier_id)
  WHERE current_tier_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. partner_qualifications materialized view
--
-- Rolling 90-day verified-retail metrics per distributor:
--   - verified_revenue_90d_minor: sum of order_items.commissionable_amount_minor
--     for paid orders the distributor sponsored in the last 90 days
--   - unique_buyers_90d:         distinct buyers in that window
--   - paid_orders_90d:           total paid orders in that window
--   - retention_score_90d:       repeat-buyer ratio (0..1) — buyers in
--                                the last 90d who ALSO bought before
--                                the 90d window
--
-- Refreshed by `refresh_partner_qualifications()` RPC in migration 024.
-- ---------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS partner_qualifications;

CREATE MATERIALIZED VIEW partner_qualifications AS
WITH order_facts AS (
  SELECT
    d.id                                                    AS distributor_id,
    o.id                                                    AS order_id,
    o.user_id                                               AS buyer_user_id,
    o.status                                                AS order_status,
    o.paid_at                                               AS paid_at,
    COALESCE(SUM(oi.commissionable_amount_minor), 0)::BIGINT AS commissionable_amount_minor
    FROM distributors d
    LEFT JOIN orders o
      ON o.sponsor_distributor_id = d.id
     AND o.status = 'paid'
     AND o.paid_at > NOW() - INTERVAL '90 days'
    LEFT JOIN order_items oi ON oi.order_id = o.id
   GROUP BY d.id, o.id, o.user_id, o.status, o.paid_at
),
prior_buyers AS (
  SELECT DISTINCT
    o.sponsor_distributor_id AS distributor_id,
    o.user_id                AS buyer_user_id
    FROM orders o
   WHERE o.status = 'paid'
     AND o.paid_at <= NOW() - INTERVAL '90 days'
)
SELECT
  d.id                                              AS distributor_id,
  COALESCE(SUM(f.commissionable_amount_minor), 0)::BIGINT
                                                    AS verified_revenue_90d_minor,
  COUNT(DISTINCT f.buyer_user_id)                   AS unique_buyers_90d,
  COUNT(DISTINCT f.order_id)                        AS paid_orders_90d,
  CASE
    WHEN COUNT(DISTINCT f.buyer_user_id) = 0 THEN 0::numeric
    ELSE (
      COUNT(DISTINCT f.buyer_user_id) FILTER (
        WHERE f.buyer_user_id IN (
          SELECT pb.buyer_user_id FROM prior_buyers pb
           WHERE pb.distributor_id = d.id
        )
      )::numeric
      / NULLIF(COUNT(DISTINCT f.buyer_user_id), 0)
    )
  END                                               AS retention_score_90d,
  NOW()                                             AS computed_at
  FROM distributors d
  LEFT JOIN order_facts f ON f.distributor_id = d.id
 GROUP BY d.id;

-- Unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_qualifications_distributor
  ON partner_qualifications (distributor_id);

-- Lock the view down. Materialized views don't support RLS; the admin
-- pages call it via the service-role client and gate access via the
-- admin auth check in the page handler.
REVOKE ALL ON partner_qualifications FROM anon, authenticated;
GRANT  SELECT ON partner_qualifications TO service_role;

-- ---------------------------------------------------------------------
-- 4. Backfill — map existing rank-based distributors to a tier
--
-- Bridge: ranks 1-2 → tier 1, 3-4 → tier 2, 5-6 → tier 3, 7-8 → tier 4.
-- Only applied where current_tier_id IS NULL (idempotent).
-- ---------------------------------------------------------------------

WITH bridge AS (
  SELECT
    cr.id            AS rank_id,
    cr.rank_position AS rank_position,
    CASE
      WHEN cr.rank_position <= 2 THEN 1
      WHEN cr.rank_position <= 4 THEN 2
      WHEN cr.rank_position <= 6 THEN 3
      ELSE 4
    END              AS tier_position
    FROM config_ranks cr
   WHERE cr.effective_until IS NULL
)
UPDATE distributors d
   SET current_tier_id = (
         SELECT pt.id
           FROM partner_tiers pt
          WHERE pt.tier_position = (
            SELECT b.tier_position
              FROM bridge b
             WHERE b.rank_id = d.current_rank_id
          )
            AND pt.effective_until IS NULL
       )
 WHERE d.current_tier_id IS NULL
   AND d.current_rank_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Audit log entry
-- ---------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '023_partner_tiers',
  jsonb_build_object(
    'description',
    'Added partner_tiers config table (seeded 4 tiers: Concierge Partner / Brand Associate / Regional Curator / Prestige Partner), distributors.current_tier_id FK, partner_qualifications materialized view (rolling 90d metrics), and bridge backfill mapping current_rank_id 1-8 to tier_id 1-4. Additive only.'
  )
);

-- DOWN (manual):
--   DROP MATERIALIZED VIEW IF EXISTS partner_qualifications;
--   ALTER TABLE distributors DROP COLUMN IF EXISTS current_tier_id;
--   DROP TABLE IF EXISTS partner_tiers;
-- All additive; rollback restores Phase-1 schema exactly.
