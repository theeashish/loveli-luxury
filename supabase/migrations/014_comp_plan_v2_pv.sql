-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMP PLAN v2 (PV-BASED)
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      014_comp_plan_v2_pv.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 2 — replace migration-013's KES-amount comp
--                 plan with the canonical PV-based plan from the
--                 client's HTML (compensation-plan-1.html).
--
-- Key shift:      Commissions are now calculated on POINT VALUE (PV),
--                 not on the order's commissionable KES amount.
--                   30ml bottle = 550 PV
--                   50ml bottle = 950 PV
--                 Commission rate × PV → KES amount in minor units
--                 directly (because 1 PV is denominated in KES face value
--                 at the L1 20% slice: 950 PV × 20% = KES 190).
--                 amount_minor = (basis_pv * rate_basis_points * 100) / 10000
--                              = basis_pv * rate_basis_points / 100
--
-- New ranks       Starter → Team Builder → Builder → Manager → Senior
--                 Manager → Director → Senior Director → President.
--                 Group targets are KES; personal targets are PV
--                 (matching "N × 50ml"-style requirements). Active-
--                 member counts climb from 10 (Starter) to 600
--                 (President).
--
-- New rates       L1 20% / L2 7% / L3 5% / L4 4% / L5 2% / L6 1.5% /
--                 L7 0.5%. Total 40% of PV.
--
-- Salaries        Open at rank 4 (Manager): 20k / 50k / 100k / 150k /
--                 250k KES monthly. Performance-based: only paid the
--                 month the group target is achieved.
--
-- Mandatory       30ml selling price = KES 1,500; 50ml = KES 2,200.
-- selling         Backfilled onto product_variants. retail_price_minor
-- prices          is rewritten to match (storefront displays the
--                 mandatory price). distributor_price_minor (IBO) =
--                 KES 900 / 1,400 — also backfilled.
--
-- Multi-month     The HTML says rank-up requires 2–3 consecutive months
-- qualifying      hitting target. We expose `qualifying_months` on
--                 config_ranks so the data is canonical; the code-side
--                 detect_rank_up still triggers on a single qualifying
--                 month (Phase 8 will add the streak counter against
--                 monthly_salaries history).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Schema lifts that 013 was supposed to do (now idempotent here too)
-- -----------------------------------------------------------------------------
-- If migration 013 was never applied to this database, 014 still needs the
-- rank_position CHECK lifted from 1..7 → 1..8 and the
-- min_personal_sales_minor column on config_ranks. Both wrapped with
-- IF NOT EXISTS / pg_constraint introspection so a re-run on a DB that
-- DID get 013 is a clean no-op.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.config_ranks'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%rank_position%'
  LOOP
    EXECUTE format('ALTER TABLE config_ranks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE config_ranks
  ADD CONSTRAINT config_ranks_rank_position_check
  CHECK (rank_position BETWEEN 1 AND 8);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.config_salary_tiers'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%rank_position%'
  LOOP
    EXECUTE format('ALTER TABLE config_salary_tiers DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE config_salary_tiers
  ADD CONSTRAINT config_salary_tiers_rank_position_check
  CHECK (rank_position BETWEEN 1 AND 8);

ALTER TABLE config_ranks
  ADD COLUMN IF NOT EXISTS min_personal_sales_minor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;


-- -----------------------------------------------------------------------------
-- 1. Schema additions — PV system
-- -----------------------------------------------------------------------------

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS pv_per_bottle INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price_minor BIGINT;

COMMENT ON COLUMN product_variants.pv_per_bottle IS
  'Point Value per single bottle. 30ml = 550, 50ml = 950. Commission base.';
COMMENT ON COLUMN product_variants.selling_price_minor IS
  'Mandatory customer-facing selling price (KES minor units). 30ml = 150000, 50ml = 220000.';

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS commission_pv INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN order_items.commission_pv IS
  'Total PV for this line. For a variant line = pv_per_bottle × quantity. For a bundle line = sum over bundle_items.';

ALTER TABLE commission_ledger
  ADD COLUMN IF NOT EXISTS basis_pv INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN commission_ledger.basis_pv IS
  'Total PV that produced this commission row. Coexists with commission_basis_minor for audit; the rate is applied to basis_pv directly.';

ALTER TABLE config_ranks
  ADD COLUMN IF NOT EXISTS min_personal_pv INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualifying_months INT NOT NULL DEFAULT 1;

COMMENT ON COLUMN config_ranks.min_personal_pv IS
  'Monthly personal stock requirement in PV. Replaces min_personal_sales_minor for the v2 plan.';
COMMENT ON COLUMN config_ranks.qualifying_months IS
  'Consecutive months a distributor must hit the rank target to advance into the rank. Single-month trigger still active until Phase 8.';


-- -----------------------------------------------------------------------------
-- 2. Backfill standard variant prices + PV
-- -----------------------------------------------------------------------------
-- Pre-launch posture: all existing 30ml and 50ml variants get the
-- canonical values from the HTML. Non-standard sizes are left untouched
-- (admin sets PV manually).

UPDATE product_variants
   SET pv_per_bottle       = 550,
       selling_price_minor = 150000,
       retail_price_minor  = 150000,
       distributor_price_minor = 90000
 WHERE size_ml = 30;

UPDATE product_variants
   SET pv_per_bottle       = 950,
       selling_price_minor = 220000,
       retail_price_minor  = 220000,
       distributor_price_minor = 140000
 WHERE size_ml = 50;


-- -----------------------------------------------------------------------------
-- 3. Close out migration-013 config rows
-- -----------------------------------------------------------------------------
UPDATE config_ranks            SET effective_until = NOW() WHERE effective_until IS NULL;
UPDATE config_commission_rates SET effective_until = NOW() WHERE effective_until IS NULL;
UPDATE config_salary_tiers     SET effective_until = NOW() WHERE effective_until IS NULL;

-- Drop any distributor rank pointers; the new ranks need fresh assignment
-- via the monthly close.
UPDATE distributors
   SET current_rank_id          = NULL,
       current_rank_achieved_at = NULL
 WHERE current_rank_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 4. New seed — 8 ranks (HTML rank summary table)
-- -----------------------------------------------------------------------------
-- PV calculations: min_personal_pv = bottles × 950 (50ml).
--   5 × 950 = 4,750  (Starter)
--  10 × 950 = 9,500  (Team Builder)
--  15 × 950 = 14,250 (Builder)
--  20 × 950 = 19,000 (Manager)
--  25 × 950 = 23,750 (Senior Manager)
--  35 × 950 = 33,250 (Director)
--  45 × 950 = 42,750 (Senior Director)
--  50 × 950 = 47,500 (President)
--
-- min_active_recruits = the "Active Members" column (10..600).
-- min_group_sales_minor = the KES "Group Target" in minor units.
-- rank_up_bonus_minor = the "Rank-Up Bonus" column.
-- qualifying_months = the "Qualifying Months" column.

INSERT INTO config_ranks (
  rank_position, rank_name, emoji,
  min_active_recruits, min_group_sales_minor, rank_up_bonus_minor,
  min_personal_sales_minor, min_personal_pv, qualifying_months, notes
) VALUES
  (1, 'Starter',          '🌱',   10,    7000000,     500000,    0,  4750, 1,
       'Entry rank. Earns L1 only. Bonus on target hit (single month).'),
  (2, 'Team Builder',     '🌿',   20,   20000000,    1000000,    0,  9500, 2,
       'Earns L1 + L2. Bonus after 2 consecutive qualifying months.'),
  (3, 'Builder',          '🥉',   35,   50000000,    2000000,    0, 14250, 2,
       'Earns L1 + L2 + L3. Bonus after 2 consecutive months.'),
  (4, 'Manager',          '🥈',   50,  100000000,    4000000,    0, 19000, 3,
       'Earns L1..L4. Lifetime monthly salary opens here (KES 20,000).'),
  (5, 'Senior Manager',   '🥇',  100,  250000000,    6000000,    0, 23750, 3,
       'Earns L1..L5. Salary KES 50,000.'),
  (6, 'Director',         '💎',  200,  450000000,   10000000,    0, 33250, 2,
       'Earns L1..L6. Salary KES 100,000.'),
  (7, 'Senior Director',  '👑',  400,  700000000,   15000000,    0, 42750, 2,
       'Earns L1..L7. Salary KES 150,000.'),
  (8, 'President',        '⭐',  600, 1000000000,   25000000,    0, 47500, 3,
       'Top rank. Full L1..L7. Salary KES 250,000. Founding President recognition.');


-- -----------------------------------------------------------------------------
-- 5. New seed — commission rates (PV-based, total 40%)
-- -----------------------------------------------------------------------------
INSERT INTO config_commission_rates (level, rate_basis_points, notes) VALUES
  (1, 2000, 'Direct Recruit · 20% of PV'),
  (2,  700, '2nd Generation · 7% of PV'),
  (3,  500, '3rd Generation · 5% of PV'),
  (4,  400, '4th Generation · 4% of PV'),
  (5,  200, '5th Generation · 2% of PV'),
  (6,  150, '6th Generation · 1.5% of PV'),
  (7,   50, '7th Generation · 0.5% of PV');


-- -----------------------------------------------------------------------------
-- 6. New seed — salary tiers (Manager and up)
-- -----------------------------------------------------------------------------
-- Salary is paid IF the month's group target is achieved. min_team_gsv_minor
-- mirrors the rank's min_group_sales_minor. performance_bonus_basis_points
-- stays 0 — the v2 plan does not have a separate perf bonus on excess GSV.

INSERT INTO config_salary_tiers (
  rank_position, min_personal_bottles, min_team_gsv_minor,
  fixed_salary_minor, performance_bonus_basis_points
) VALUES
  (1, 0,           0,          0, 0),
  (2, 0,           0,          0, 0),
  (3, 0,           0,          0, 0),
  (4, 0,   100000000,    2000000, 0),   -- Manager:         KES  20,000
  (5, 0,   250000000,    5000000, 0),   -- Senior Manager:  KES  50,000
  (6, 0,   450000000,   10000000, 0),   -- Director:        KES 100,000
  (7, 0,   700000000,   15000000, 0),   -- Senior Director: KES 150,000
  (8, 0,  1000000000,   25000000, 0);   -- President:       KES 250,000


-- -----------------------------------------------------------------------------
-- 7. is_distributor_maintained — switch to PV
-- -----------------------------------------------------------------------------
-- Sum order_items.commission_pv for orders WHERE user_id = distributor's
-- user_id AND status paid+ AND paid_at in the period. Compare to current
-- rank's min_personal_pv (Newbie/NULL falls back to rank-1 Starter).

CREATE OR REPLACE FUNCTION public.is_distributor_maintained(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       UUID;
  v_required_pv   INT;
  v_period_start  TIMESTAMPTZ;
  v_period_end    TIMESTAMPTZ;
  v_actual_pv     BIGINT;
BEGIN
  SELECT d.user_id, cr.min_personal_pv
    INTO v_user_id, v_required_pv
    FROM distributors d
    LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
   WHERE d.id = p_distributor_id;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Newbie / un-ranked falls back to Starter (rank 1) threshold.
  IF v_required_pv IS NULL THEN
    SELECT min_personal_pv INTO v_required_pv
      FROM config_ranks
     WHERE rank_position = 1
       AND effective_until IS NULL
     ORDER BY effective_from DESC LIMIT 1;
    v_required_pv := COALESCE(v_required_pv, 0);
  END IF;

  IF v_required_pv = 0 THEN
    RETURN TRUE;
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COALESCE(SUM(oi.commission_pv), 0)::BIGINT
    INTO v_actual_pv
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.user_id = v_user_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end;

  RETURN v_actual_pv >= v_required_pv;
END;
$$;

REVOKE ALL ON FUNCTION public.is_distributor_maintained(BIGINT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_distributor_maintained(BIGINT, INT, INT)
  TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 8. write_commission_ledger — PV-based commissions
-- -----------------------------------------------------------------------------
-- Pulls basis_pv from order_items.commission_pv (sum). For each
-- recipient that passes the rank gate and the maintenance gate, the
-- commission amount in minor units is:
--   amount_minor = basis_pv * rate_basis_points / 100
-- which is equivalent to the KES per bottle in the HTML
-- (e.g. 50ml at L1: 950 * 2000 / 100 = 19,000 cents = KES 190).
--
-- commission_basis_minor on the ledger keeps its old meaning
-- (commissionable amount in KES cents from the order line) so historical
-- queries still resolve, but the rate is now applied to basis_pv.

CREATE OR REPLACE FUNCTION public.write_commission_ledger(p_order_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status                order_status;
  v_paid_at               TIMESTAMPTZ;
  v_sponsor_distributor   BIGINT;
  v_basis_minor           BIGINT;
  v_basis_pv              INT;
  v_existing              INT;
  v_count                 INT := 0;
  v_compression_enabled   BOOLEAN;
  v_period_year           INT;
  v_period_month          INT;
  rec                     RECORD;
  v_rate_id               BIGINT;
  v_rate_bp               INT;
  v_amount                BIGINT;
  v_recipient_rank_pos    INT;
  v_recipient_max_level   INT;
  v_maintained            BOOLEAN;
BEGIN
  SELECT status, paid_at, sponsor_distributor_id
    INTO v_status, v_paid_at, v_sponsor_distributor
    FROM orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status <> 'paid' THEN
    RAISE EXCEPTION 'order % is not paid (status=%)', p_order_id, v_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_sponsor_distributor IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_existing
    FROM commission_ledger
   WHERE source_order_id = p_order_id;
  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  -- Pull both PV and minor totals from the order. PV drives the rate;
  -- minor stays on the ledger row for audit / display.
  SELECT
    COALESCE(SUM(commission_pv), 0)::INT,
    COALESCE(SUM(commissionable_amount_minor), 0)::BIGINT
    INTO v_basis_pv, v_basis_minor
    FROM order_items
   WHERE order_id = p_order_id
     AND is_commissionable = TRUE;

  IF v_basis_pv = 0 THEN
    RETURN 0;
  END IF;

  v_paid_at      := COALESCE(v_paid_at, NOW());
  v_period_year  := EXTRACT(YEAR  FROM v_paid_at AT TIME ZONE 'UTC')::INT;
  v_period_month := EXTRACT(MONTH FROM v_paid_at AT TIME ZONE 'UTC')::INT;

  v_compression_enabled := public.get_setting_bool(
    'commission_compression_enabled', FALSE
  );

  FOR rec IN
    WITH chain AS (
      SELECT dt.ancestor_id, dt.depth AS chain_depth, d.is_active
        FROM distributor_tree dt
        JOIN distributors    d  ON d.id = dt.ancestor_id
       WHERE dt.descendant_id = v_sponsor_distributor
         AND CASE
               WHEN v_compression_enabled THEN dt.depth BETWEEN 0 AND 13
               ELSE dt.depth BETWEEN 0 AND 6
             END
    ),
    compressed AS (
      SELECT ancestor_id,
             ROW_NUMBER() OVER (ORDER BY chain_depth ASC) AS lvl
        FROM chain
       WHERE is_active = TRUE
    ),
    plain AS (
      SELECT ancestor_id, chain_depth + 1 AS lvl
        FROM chain
    )
    SELECT ancestor_id AS recipient_distributor_id,
           lvl         AS commission_level
      FROM (
        SELECT ancestor_id, lvl FROM compressed
         WHERE v_compression_enabled = TRUE
        UNION ALL
        SELECT ancestor_id, lvl FROM plain
         WHERE v_compression_enabled = FALSE
      ) chosen
     WHERE lvl BETWEEN 1 AND 7
     ORDER BY commission_level ASC
  LOOP
    -- Rank gate
    SELECT cr.rank_position INTO v_recipient_rank_pos
      FROM distributors d
      LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
     WHERE d.id = rec.recipient_distributor_id;
    v_recipient_max_level := COALESCE(v_recipient_rank_pos, 1);
    IF rec.commission_level > v_recipient_max_level THEN
      CONTINUE;
    END IF;

    -- Maintenance gate
    v_maintained := public.is_distributor_maintained(
      rec.recipient_distributor_id, v_period_year, v_period_month
    );
    IF NOT v_maintained THEN
      CONTINUE;
    END IF;

    -- Active rate at paid_at
    SELECT id, rate_basis_points
      INTO v_rate_id, v_rate_bp
      FROM config_commission_rates
     WHERE level = rec.commission_level
       AND effective_from <= v_paid_at
       AND (effective_until IS NULL OR effective_until > v_paid_at)
     ORDER BY effective_from DESC
     LIMIT 1;
    IF v_rate_id IS NULL THEN
      CONTINUE;
    END IF;

    -- PV-based amount: 950 PV × 2000bp / 100 = 19,000 cents = KES 190.
    v_amount := (v_basis_pv::BIGINT * v_rate_bp) / 100;
    IF v_amount = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO commission_ledger (
      distributor_id,
      source_order_id,
      source_distributor_id,
      level,
      commission_basis_minor,
      basis_pv,
      rate_basis_points,
      amount_minor,
      currency,
      config_commission_rate_id,
      earned_at
    ) VALUES (
      rec.recipient_distributor_id,
      p_order_id,
      v_sponsor_distributor,
      rec.commission_level,
      v_basis_minor,
      v_basis_pv,
      v_rate_bp,
      v_amount,
      'KES',
      v_rate_id,
      v_paid_at
    );
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO audit_log (
    actor_id, action, resource_type, resource_id, after_data
  ) VALUES (
    NULL,
    'commission.ledger_written',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'rows_written',          v_count,
      'basis_pv',              v_basis_pv,
      'basis_minor',           v_basis_minor,
      'sponsor_distributor_id', v_sponsor_distributor,
      'compression_enabled',   v_compression_enabled,
      'period_year',           v_period_year,
      'period_month',          v_period_month
    )
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_commission_ledger(BIGINT) TO service_role;


-- -----------------------------------------------------------------------------
-- 9. Backfill commission_pv on existing order_items
-- -----------------------------------------------------------------------------
-- For variant lines: commission_pv = pv_per_bottle * quantity
-- For bundle lines: sum over bundle_items.quantity * variant.pv_per_bottle
-- Skips lines with no resolvable PV (commission_pv stays 0).

UPDATE order_items oi
   SET commission_pv = pv.total
  FROM (
    SELECT oi2.id,
           (pv2.pv_per_bottle * oi2.quantity)::INT AS total
      FROM order_items oi2
      JOIN product_variants pv2 ON pv2.id = oi2.variant_id
     WHERE oi2.variant_id IS NOT NULL
  ) pv
 WHERE oi.id = pv.id;

UPDATE order_items oi
   SET commission_pv = b.total
  FROM (
    SELECT oi2.id,
           (SUM(bi.quantity * pv.pv_per_bottle) * oi2.quantity)::INT AS total
      FROM order_items oi2
      JOIN bundle_items bi ON bi.bundle_id = oi2.bundle_id
      JOIN product_variants pv ON pv.id = bi.variant_id
     WHERE oi2.bundle_id IS NOT NULL
     GROUP BY oi2.id, oi2.quantity
  ) b
 WHERE oi.id = b.id;


-- =============================================================================
-- END OF MIGRATION 014
-- =============================================================================
