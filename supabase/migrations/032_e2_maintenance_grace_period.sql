-- 032_e2_maintenance_grace_period.sql
--
-- E2 of the deferred comp-engine items: maintenance grace-period. Ships the
-- scaffolding so the personal-PV maintenance gate can be turned on with a
-- forgiveness window WITHOUT further code changes. Activation is a config
-- decision: set `config_ranks.min_personal_pv > 0` AND
-- `config_ranks.maintenance_grace_months > 0` on the ranks you want gated.
--
-- Policy implemented:
--   "N consecutive failed months allowed; any passing month resets the streak."
-- A partner is *maintained* in month M if EITHER they meet the PV threshold
-- in M, OR they have not yet stacked up more than N consecutive failed months
-- through M (where N = config_ranks.maintenance_grace_months for their rank).
--
-- Default state: every rank has min_personal_pv = 0 (per migration 029), so
-- is_distributor_meeting_pv returns TRUE and is_distributor_maintained never
-- enters the grace branch. **Gate is OFF until the owner configures it.**
--
-- Applied via MCP on 2026-05-28.

-- ----------------------------------------------------------------------
-- 1. Schema
-- ----------------------------------------------------------------------

ALTER TABLE public.config_ranks
  ADD COLUMN IF NOT EXISTS maintenance_grace_months INTEGER;

COMMENT ON COLUMN public.config_ranks.maintenance_grace_months IS
  'E2 (2026-05-28): maintenance grace window in consecutive months. NULL or 0 '
  'means no grace (strict maintenance). Positive N means a partner stays '
  'maintained even when failing the PV threshold, as long as they have not '
  'failed more than N months in a row. Any passing month resets the streak.';

-- ----------------------------------------------------------------------
-- 2. is_distributor_meeting_pv — the strict per-month check.
-- This is the OLD is_distributor_maintained body, unchanged in semantics.
-- Lifted to its own function so the new grace-aware wrapper can call it
-- recursively over prior months without infinite recursion.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_distributor_meeting_pv(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

-- ----------------------------------------------------------------------
-- 3. is_distributor_maintained — grace-aware wrapper.
-- Strict pass returns TRUE immediately. Otherwise, walks back through
-- prior months calling is_distributor_meeting_pv until either a passing
-- month is found (streak broken, still maintained) or the grace window
-- is exhausted (lock).
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_distributor_maintained(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_grace             INT;
  v_meets_now         BOOLEAN;
  v_consecutive_fails INT := 1;  -- includes the current failed month
  v_y                 INT := p_year;
  v_m                 INT := p_month;
  v_i                 INT;
BEGIN
  v_meets_now := public.is_distributor_meeting_pv(p_distributor_id, p_year, p_month);
  IF v_meets_now THEN
    RETURN TRUE;
  END IF;

  SELECT cr.maintenance_grace_months
    INTO v_grace
    FROM distributors d
    LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
   WHERE d.id = p_distributor_id;

  IF v_grace IS NULL OR v_grace <= 0 THEN
    -- No grace configured for this rank → strict lock on first failed month.
    RETURN FALSE;
  END IF;

  -- Walk back v_grace months. If any prior month passed, the failure
  -- streak is broken and we are inside the grace window.
  FOR v_i IN 1..v_grace LOOP
    IF v_m = 1 THEN
      v_m := 12;
      v_y := v_y - 1;
    ELSE
      v_m := v_m - 1;
    END IF;

    IF public.is_distributor_meeting_pv(p_distributor_id, v_y, v_m) THEN
      -- Recent passing month → inside grace.
      RETURN TRUE;
    END IF;

    v_consecutive_fails := v_consecutive_fails + 1;
  END LOOP;

  -- v_grace+1 consecutive failures → grace exhausted → lock.
  RETURN FALSE;
END;
$function$;

-- ----------------------------------------------------------------------
-- 4. Audit log
-- ----------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '032_e2_maintenance_grace_period',
  jsonb_build_object(
    'description',
    'E2: ships maintenance grace-period scaffolding. Adds config_ranks.maintenance_grace_months, splits is_distributor_meeting_pv (strict) from is_distributor_maintained (grace-aware). Gate stays off until owner sets min_personal_pv > 0 and a grace window per rank.',
    'policy', 'N consecutive failed months allowed; any passing month resets the streak',
    'gate_state', 'inert (min_personal_pv = 0 on all ranks)'
  )
);

NOTIFY pgrst, 'reload schema';
