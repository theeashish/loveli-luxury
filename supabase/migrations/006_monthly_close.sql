-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MONTHLY CLOSE RPCs
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      006_monthly_close.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 4 wave 2.
--                 Three idempotent RPCs that together compose a monthly
--                 close run for one distributor:
--                   compute_gsv_snapshot   — denormalised period totals
--                   compute_monthly_salary — qualifier + salary + perf bonus
--                   detect_rank_up         — promote + insert rank bonus
--                 The admin UI orchestrates these by iterating active
--                 distributors and calling each in turn for the chosen
--                 (year, month). Re-running close for the same month is
--                 safe — rows already attached to a payout are not
--                 overwritten.
-- Period model:   We key on calendar UTC months. A row with
--                 (period_year, period_month) covers
--                 [YYYY-MM-01 00:00 UTC, YYYY-(MM+1)-01 00:00 UTC).
-- Status filter:  "Counts as a sale" = order.status IN
--                 (paid, fulfilled, shipped, delivered). We exclude
--                 refunded/cancelled/failed/pending. If a paid order is
--                 later refunded, re-running close removes it from the
--                 totals — by design.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- compute_gsv_snapshot
-- -----------------------------------------------------------------------------
-- Returns:
--   gsv_snapshots.id (always — upsert)
--
-- What we count for a given (distributor, year, month):
--   personal_bottles_sold = sum of variant-line quantities on paid orders
--                           where this distributor is the buyer's sponsor
--   personal_sales_minor  = sum of order_items.commissionable_amount_minor
--                           for those same orders
--   team_gsv_minor        = sum of commissionable_amount_minor across paid
--                           orders sponsored by ANY descendant in this
--                           distributor's tree (including themselves)
--   active_recruits_count = count of direct downline (depth=1) distributors
--                           who logged at least one paid order in the period

CREATE OR REPLACE FUNCTION public.compute_gsv_snapshot(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_start      TIMESTAMPTZ;
  v_period_end        TIMESTAMPTZ;
  v_personal_bottles  INT;
  v_personal_sales    BIGINT;
  v_team_gsv          BIGINT;
  v_active_recruits   INT;
  v_id                BIGINT;
BEGIN
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'invalid month %', p_month USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  -- Personal bottles (variant lines only — bundles count by line, not by
  -- contained variants, in this aggregate)
  SELECT COALESCE(SUM(oi.quantity), 0) INTO v_personal_bottles
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.sponsor_distributor_id = p_distributor_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.variant_id IS NOT NULL;

  -- Personal commissionable sales
  SELECT COALESCE(SUM(oi.commissionable_amount_minor), 0)::BIGINT
    INTO v_personal_sales
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.sponsor_distributor_id = p_distributor_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.is_commissionable = TRUE;

  -- Team GSV: closure-table fan-out
  SELECT COALESCE(SUM(oi.commissionable_amount_minor), 0)::BIGINT
    INTO v_team_gsv
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.sponsor_distributor_id IN (
           SELECT descendant_id
             FROM distributor_tree
            WHERE ancestor_id = p_distributor_id
         )
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.is_commissionable = TRUE;

  -- Active direct recruits — anyone at depth=1 with a paid sale this month
  SELECT COUNT(DISTINCT d.id) INTO v_active_recruits
    FROM distributor_tree dt
    JOIN distributors d ON d.id = dt.descendant_id
   WHERE dt.ancestor_id = p_distributor_id
     AND dt.depth = 1
     AND EXISTS (
       SELECT 1 FROM orders o
        WHERE o.sponsor_distributor_id = d.id
          AND o.status IN ('paid','fulfilled','shipped','delivered')
          AND o.paid_at >= v_period_start
          AND o.paid_at <  v_period_end
     );

  INSERT INTO gsv_snapshots (
    distributor_id, period_year, period_month,
    personal_bottles_sold, personal_sales_minor,
    team_gsv_minor, active_recruits_count
  ) VALUES (
    p_distributor_id, p_year, p_month,
    v_personal_bottles, v_personal_sales,
    v_team_gsv, v_active_recruits
  )
  ON CONFLICT (distributor_id, period_year, period_month) DO UPDATE SET
    personal_bottles_sold = EXCLUDED.personal_bottles_sold,
    personal_sales_minor  = EXCLUDED.personal_sales_minor,
    team_gsv_minor        = EXCLUDED.team_gsv_minor,
    active_recruits_count = EXCLUDED.active_recruits_count,
    computed_at           = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- compute_monthly_salary
-- -----------------------------------------------------------------------------
-- Reads the GSV snapshot (which must already exist for this period) and
-- the active config_salary_tiers row for the distributor's CURRENT rank
-- position. Inserts/updates monthly_salaries.
--
-- Qualifier: personal_bottles_sold >= tier.min_personal_bottles
--            AND team_gsv_minor   >= tier.min_team_gsv_minor
-- Performance bonus on excess GSV: floor((team_gsv - threshold) * bp / 10000)
--
-- Idempotency: ON CONFLICT updates in place. Rows already attached to a
-- payout (payout_id NOT NULL) are NEVER overwritten — that history is
-- locked once it's been disbursed.
--
-- Returns: monthly_salaries.id (always)

CREATE OR REPLACE FUNCTION public.compute_monthly_salary(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_end       TIMESTAMPTZ;
  v_personal_bottles INT;
  v_team_gsv         BIGINT;
  v_rank_id          BIGINT;
  v_rank_position    INT;
  v_tier_min_bottles INT := 0;
  v_tier_min_gsv     BIGINT := 0;
  v_tier_fixed       BIGINT := 0;
  v_tier_bp          INT    := 0;
  v_qualified        BOOLEAN := FALSE;
  v_fixed            BIGINT := 0;
  v_perf             BIGINT := 0;
  v_total            BIGINT := 0;
  v_existing_id      BIGINT;
  v_existing_payout  BIGINT;
  v_id               BIGINT;
BEGIN
  v_period_end := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC')
                  + INTERVAL '1 month';

  SELECT personal_bottles_sold, team_gsv_minor
    INTO v_personal_bottles, v_team_gsv
    FROM gsv_snapshots
   WHERE distributor_id = p_distributor_id
     AND period_year   = p_year
     AND period_month  = p_month;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gsv snapshot missing for distributor % %-%; run compute_gsv_snapshot first',
      p_distributor_id, p_year, p_month
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Distributor's current rank. Default to position 1 (Starter) if unset.
  SELECT current_rank_id INTO v_rank_id
    FROM distributors WHERE id = p_distributor_id;

  IF v_rank_id IS NULL THEN
    SELECT id INTO v_rank_id
      FROM config_ranks
     WHERE rank_position = 1
       AND effective_until IS NULL
     ORDER BY effective_from DESC LIMIT 1;
  END IF;

  SELECT rank_position INTO v_rank_position
    FROM config_ranks WHERE id = v_rank_id;
  v_rank_position := COALESCE(v_rank_position, 1);

  -- Active salary tier at end-of-period
  SELECT min_personal_bottles, min_team_gsv_minor,
         fixed_salary_minor, performance_bonus_basis_points
    INTO v_tier_min_bottles, v_tier_min_gsv,
         v_tier_fixed, v_tier_bp
    FROM config_salary_tiers
   WHERE rank_position = v_rank_position
     AND effective_from <= v_period_end
     AND (effective_until IS NULL OR effective_until > v_period_end)
   ORDER BY effective_from DESC LIMIT 1;

  -- If FOUND, evaluate the qualifier; otherwise everything stays at zero
  IF FOUND THEN
    v_qualified := v_personal_bottles >= v_tier_min_bottles
               AND v_team_gsv         >= v_tier_min_gsv;
    IF v_qualified THEN
      v_fixed := v_tier_fixed;
      IF v_team_gsv > v_tier_min_gsv AND v_tier_bp > 0 THEN
        v_perf := ((v_team_gsv - v_tier_min_gsv) * v_tier_bp) / 10000;
      END IF;
      v_total := v_fixed + v_perf;
    END IF;
  END IF;

  -- Honour the locked-history rule: if this period's salary is already in
  -- a payout, do not touch it. Return the existing id.
  SELECT id, payout_id INTO v_existing_id, v_existing_payout
    FROM monthly_salaries
   WHERE distributor_id = p_distributor_id
     AND period_year   = p_year
     AND period_month  = p_month;

  IF FOUND AND v_existing_payout IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO monthly_salaries (
    distributor_id, period_year, period_month,
    rank_at_period_id, personal_bottles_sold, team_gsv_minor,
    qualified, fixed_salary_minor, performance_bonus_minor, total_minor
  ) VALUES (
    p_distributor_id, p_year, p_month,
    v_rank_id, v_personal_bottles, v_team_gsv,
    v_qualified, v_fixed, v_perf, v_total
  )
  ON CONFLICT (distributor_id, period_year, period_month) DO UPDATE SET
    rank_at_period_id       = EXCLUDED.rank_at_period_id,
    personal_bottles_sold   = EXCLUDED.personal_bottles_sold,
    team_gsv_minor          = EXCLUDED.team_gsv_minor,
    qualified               = EXCLUDED.qualified,
    fixed_salary_minor      = EXCLUDED.fixed_salary_minor,
    performance_bonus_minor = EXCLUDED.performance_bonus_minor,
    total_minor             = EXCLUDED.total_minor,
    computed_at             = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- detect_rank_up
-- -----------------------------------------------------------------------------
-- Walks config_ranks looking for the highest rank whose thresholds the
-- distributor's GSV snapshot satisfies. If that rank is higher than the
-- current rank, promotes the distributor and inserts a rank_up_bonuses row.
-- The UNIQUE(distributor_id, rank_id) on rank_up_bonuses makes the bonus
-- once-only across history — a re-promotion to the same rank yields no
-- duplicate row.
--
-- Returns: the new rank_position, or NULL if no promotion occurred.

CREATE OR REPLACE FUNCTION public.detect_rank_up(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_end             TIMESTAMPTZ;
  v_team_gsv               BIGINT;
  v_active_recruits        INT;
  v_current_rank_position  INT := 1;
  v_target_rank_id         BIGINT;
  v_target_rank_position   INT;
  v_target_bonus_minor     BIGINT;
BEGIN
  v_period_end := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC')
                  + INTERVAL '1 month';

  SELECT team_gsv_minor, active_recruits_count
    INTO v_team_gsv, v_active_recruits
    FROM gsv_snapshots
   WHERE distributor_id = p_distributor_id
     AND period_year   = p_year
     AND period_month  = p_month;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT cr.rank_position INTO v_current_rank_position
    FROM distributors d
    LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
   WHERE d.id = p_distributor_id;
  v_current_rank_position := COALESCE(v_current_rank_position, 1);

  SELECT id, rank_position, rank_up_bonus_minor
    INTO v_target_rank_id, v_target_rank_position, v_target_bonus_minor
    FROM config_ranks
   WHERE effective_from <= v_period_end
     AND (effective_until IS NULL OR effective_until > v_period_end)
     AND min_active_recruits   <= v_active_recruits
     AND min_group_sales_minor <= v_team_gsv
   ORDER BY rank_position DESC
   LIMIT 1;

  IF NOT FOUND OR v_target_rank_position <= v_current_rank_position THEN
    RETURN NULL;
  END IF;

  UPDATE distributors
     SET current_rank_id          = v_target_rank_id,
         current_rank_achieved_at = NOW()
   WHERE id = p_distributor_id;

  IF v_target_bonus_minor > 0 THEN
    INSERT INTO rank_up_bonuses (distributor_id, rank_id, amount_minor)
    VALUES (p_distributor_id, v_target_rank_id, v_target_bonus_minor)
    ON CONFLICT (distributor_id, rank_id) DO NOTHING;
  END IF;

  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'distributor.rank_up',
    'distributors',
    p_distributor_id::TEXT,
    jsonb_build_object(
      'from_rank_position', v_current_rank_position,
      'to_rank_position',   v_target_rank_position,
      'period_year',        p_year,
      'period_month',       p_month
    )
  );

  RETURN v_target_rank_position;
END;
$$;


-- -----------------------------------------------------------------------------
-- Lock down: service-role only on all three.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.compute_gsv_snapshot(BIGINT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_gsv_snapshot(BIGINT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_gsv_snapshot(BIGINT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.compute_monthly_salary(BIGINT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_monthly_salary(BIGINT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_monthly_salary(BIGINT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 006
-- =============================================================================
