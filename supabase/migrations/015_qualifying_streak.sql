-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MULTI-MONTH QUALIFYING STREAK
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      015_qualifying_streak.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 3 — enforce the rank-up rule from the
--                 client's HTML comp plan that rank promotion requires
--                 N consecutive qualifying months (1..3 depending on the
--                 target rank). Until now detect_rank_up triggered on a
--                 single qualifying month; this migration closes that.
--
-- New helpers:
--   is_distributor_qualified_for_rank(distributor, rank, year, month)
--     One-month qualifier check: maintained personal stock AND
--     team_gsv ≥ rank.min_group_sales_minor AND
--     active_recruits ≥ rank.min_active_recruits.
--
--   count_qualifying_streak(distributor, target_rank, year, month, max)
--     Walks backwards from (year, month) tallying consecutive qualifying
--     months for the target rank. Stops at first non-qualifying month
--     or at `max` months (so the caller can ask for exactly what the
--     rank requires without scanning history forever).
--
-- detect_rank_up changes:
--   - Now strictly sequential: only considers rank_position = current+1.
--     Skipping ranks would skip rank-up bonuses (HTML implies you climb
--     one at a time).
--   - Streak gate: if target.qualifying_months > 1, the streak ending at
--     the current month must equal-or-exceed that count.
--   - Maintenance check stays as a pre-condition for the current month.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. is_distributor_qualified_for_rank
-- -----------------------------------------------------------------------------
-- Returns TRUE iff, in the given (year, month):
--   - gsv_snapshots row exists for the distributor
--   - maintained (personal PV ≥ current rank's min_personal_pv)
--   - team_gsv_minor ≥ target rank's min_group_sales_minor
--   - active_recruits_count ≥ target rank's min_active_recruits

CREATE OR REPLACE FUNCTION public.is_distributor_qualified_for_rank(
  p_distributor_id BIGINT,
  p_rank_id        BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rank_team_minor   BIGINT;
  v_rank_min_actives  INT;
  v_team_gsv          BIGINT;
  v_active_recruits   INT;
  v_maintained        BOOLEAN;
BEGIN
  SELECT min_group_sales_minor, min_active_recruits
    INTO v_rank_team_minor, v_rank_min_actives
    FROM config_ranks
   WHERE id = p_rank_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT team_gsv_minor, active_recruits_count
    INTO v_team_gsv, v_active_recruits
    FROM gsv_snapshots
   WHERE distributor_id = p_distributor_id
     AND period_year    = p_year
     AND period_month   = p_month;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_maintained := public.is_distributor_maintained(
    p_distributor_id, p_year, p_month
  );
  IF NOT v_maintained THEN
    RETURN FALSE;
  END IF;

  RETURN v_team_gsv        >= v_rank_team_minor
     AND v_active_recruits >= v_rank_min_actives;
END;
$$;

REVOKE ALL ON FUNCTION public.is_distributor_qualified_for_rank(BIGINT, BIGINT, INT, INT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_distributor_qualified_for_rank(BIGINT, BIGINT, INT, INT)
  TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. count_qualifying_streak
-- -----------------------------------------------------------------------------
-- Walks backward from (ending_year, ending_month) counting consecutive
-- qualifying months for the target rank. Returns 0 if the ending month
-- itself doesn't qualify. Cap loop iterations at p_max so we never
-- scan unbounded history for ranks needing only 2-3 months.

CREATE OR REPLACE FUNCTION public.count_qualifying_streak(
  p_distributor_id  BIGINT,
  p_target_rank_id  BIGINT,
  p_ending_year     INT,
  p_ending_month    INT,
  p_max             INT
) RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count     INT := 0;
  v_year      INT := p_ending_year;
  v_month     INT := p_ending_month;
  v_qualified BOOLEAN;
BEGIN
  IF p_max <= 0 THEN
    RETURN 0;
  END IF;

  WHILE v_count < p_max LOOP
    v_qualified := public.is_distributor_qualified_for_rank(
      p_distributor_id, p_target_rank_id, v_year, v_month
    );
    EXIT WHEN NOT v_qualified;

    v_count := v_count + 1;

    -- Step back one month.
    v_month := v_month - 1;
    IF v_month < 1 THEN
      v_month := 12;
      v_year  := v_year - 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.count_qualifying_streak(BIGINT, BIGINT, INT, INT, INT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_qualifying_streak(BIGINT, BIGINT, INT, INT, INT)
  TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. detect_rank_up — sequential + streak-gated
-- -----------------------------------------------------------------------------
-- Replaces migration-013's version (which scanned all ranks for the
-- highest qualifier). New version:
--   - Computes current rank_position (NULL → 0).
--   - Picks target = current + 1; if no such rank exists, return NULL
--     (already at top).
--   - Checks current-month qualification for target. If not qualified,
--     return NULL.
--   - If target.qualifying_months > 1, computes the streak; if streak
--     < required, return NULL.
--   - Promotes the distributor, inserts rank_up_bonuses (UNIQUE per
--     distributor+rank → once-only across history), audit_logs.

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
  v_current_rank_position  INT := 0;
  v_target_position        INT;
  v_target_rank_id         BIGINT;
  v_target_rank_bonus      BIGINT;
  v_target_qual_months     INT;
  v_qualified              BOOLEAN;
  v_streak                 INT;
BEGIN
  -- Current rank (NULL → 0 = Newbie, pre-Starter)
  SELECT cr.rank_position INTO v_current_rank_position
    FROM distributors d
    LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
   WHERE d.id = p_distributor_id;
  v_current_rank_position := COALESCE(v_current_rank_position, 0);

  v_target_position := v_current_rank_position + 1;

  SELECT id, rank_up_bonus_minor, qualifying_months
    INTO v_target_rank_id, v_target_rank_bonus, v_target_qual_months
    FROM config_ranks
   WHERE rank_position = v_target_position
     AND effective_until IS NULL
   ORDER BY effective_from DESC
   LIMIT 1;
  IF NOT FOUND THEN
    -- Already at the top of the live ladder.
    RETURN NULL;
  END IF;

  -- Single-month qualifier for the target rank
  v_qualified := public.is_distributor_qualified_for_rank(
    p_distributor_id, v_target_rank_id, p_year, p_month
  );
  IF NOT v_qualified THEN
    RETURN NULL;
  END IF;

  -- Streak gate (only if rank requires more than one qualifying month)
  IF COALESCE(v_target_qual_months, 1) > 1 THEN
    v_streak := public.count_qualifying_streak(
      p_distributor_id, v_target_rank_id, p_year, p_month, v_target_qual_months
    );
    IF v_streak < v_target_qual_months THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Promote
  UPDATE distributors
     SET current_rank_id          = v_target_rank_id,
         current_rank_achieved_at = NOW()
   WHERE id = p_distributor_id;

  -- One-time rank-up bonus. UNIQUE(distributor_id, rank_id) keeps this
  -- idempotent across re-runs of close for the same period.
  IF COALESCE(v_target_rank_bonus, 0) > 0 THEN
    INSERT INTO rank_up_bonuses (distributor_id, rank_id, amount_minor)
    VALUES (p_distributor_id, v_target_rank_id, v_target_rank_bonus)
    ON CONFLICT (distributor_id, rank_id) DO NOTHING;
  END IF;

  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'distributor.rank_up',
    'distributors',
    p_distributor_id::TEXT,
    jsonb_build_object(
      'from_rank_position',   v_current_rank_position,
      'to_rank_position',     v_target_position,
      'qualifying_months',    v_target_qual_months,
      'period_year',          p_year,
      'period_month',         p_month
    )
  );

  RETURN v_target_position;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 015
-- =============================================================================
