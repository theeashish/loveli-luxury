-- 031_e1_crown_president_active_customers.sql
--
-- E1 of the deferred comp-engine items: Crown President "75 active customers"
-- requirement. Adds the schema, snapshot field, and engine wiring; only Crown
-- President (rank_position 5) is gated in this migration. Lower ranks have
-- min_active_customers IS NULL and are unaffected.
--
-- "Active customer" definition for partner D in month M:
--   distinct retail buyer (deduped by COALESCE(user_id::text,
--   customer_phone, customer_email::text)) with at least one order where:
--     sponsor_distributor_id = D.id
--     kind != 'distributor_signup'
--     status IN ('paid','fulfilled','shipped','delivered')
--     paid_at in [start_of_M, start_of_M+1 month)
--
-- Versioned config update preserves history: the prior Crown President row
-- is closed at NOW(), a new row carries min_active_customers=75 from NOW().
-- Past months evaluate against the old row (no requirement); current/future
-- months evaluate against the new row (gated at 75).
--
-- Applied via MCP on 2026-05-28. Verified: live config shows Crown President
-- with min_active_customers=75, ranks 1-4 still NULL; all three engine
-- functions carry the new column / gate.

-- ----------------------------------------------------------------------
-- 1. Schema additions
-- ----------------------------------------------------------------------

ALTER TABLE public.config_ranks
  ADD COLUMN IF NOT EXISTS min_active_customers INTEGER;

COMMENT ON COLUMN public.config_ranks.min_active_customers IS
  'E1 (2026-05-28): minimum distinct retail customers per qualifying month. '
  'NULL means no requirement. Counted from gsv_snapshots.active_customers_count.';

ALTER TABLE public.gsv_snapshots
  ADD COLUMN IF NOT EXISTS active_customers_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.gsv_snapshots.active_customers_count IS
  'E1 (2026-05-28): distinct retail customers attributed to this distributor '
  'this period. Dedup key: COALESCE(user_id::text, customer_phone, customer_email::text). '
  'Existing rows default to 0; correct values land when compute_gsv_snapshot runs.';

-- ----------------------------------------------------------------------
-- 2. Versioned config: close current Crown President row, insert new one
-- with min_active_customers = 75. NO new schema row is created; only data.
-- ----------------------------------------------------------------------

DO $$
DECLARE
  v_closed_id BIGINT;
BEGIN
  UPDATE public.config_ranks
     SET effective_until = NOW()
   WHERE rank_position = 5
     AND effective_until IS NULL
   RETURNING id INTO v_closed_id;

  IF v_closed_id IS NULL THEN
    RAISE EXCEPTION 'no active Crown President row found to version; aborting E1 config update';
  END IF;

  INSERT INTO public.config_ranks (
    rank_position, rank_name, emoji,
    min_active_recruits, min_group_sales_minor, rank_up_bonus_minor,
    min_personal_sales_minor, min_personal_pv, qualifying_months,
    min_active_customers, effective_from, notes
  )
  SELECT
    rank_position, rank_name, emoji,
    min_active_recruits, min_group_sales_minor, rank_up_bonus_minor,
    min_personal_sales_minor, min_personal_pv, qualifying_months,
    75 AS min_active_customers,
    NOW() AS effective_from,
    COALESCE(notes || E'\n', '') ||
      'E1 (2026-05-28): min_active_customers raised from NULL to 75 per client comp plan.'
      AS notes
  FROM public.config_ranks
  WHERE id = v_closed_id;
END;
$$;

-- ----------------------------------------------------------------------
-- 3. compute_gsv_snapshot — extended to compute active_customers_count.
-- Body is the original (006) plus the new aggregate + INSERT field.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_gsv_snapshot(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_period_start      TIMESTAMPTZ;
  v_period_end        TIMESTAMPTZ;
  v_personal_bottles  INT;
  v_personal_sales    BIGINT;
  v_team_gsv          BIGINT;
  v_active_recruits   INT;
  v_active_customers  INT;
  v_id                BIGINT;
BEGIN
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'invalid month %', p_month USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COALESCE(SUM(oi.quantity), 0) INTO v_personal_bottles
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.sponsor_distributor_id = p_distributor_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.variant_id IS NOT NULL;

  SELECT COALESCE(SUM(oi.commissionable_amount_minor), 0)::BIGINT
    INTO v_personal_sales
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.sponsor_distributor_id = p_distributor_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.is_commissionable = TRUE;

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

  -- E1: Active customers — distinct retail buyers sponsored by this distributor
  SELECT COUNT(DISTINCT COALESCE(o.user_id::text, o.customer_phone, o.customer_email::text))
    INTO v_active_customers
    FROM orders o
   WHERE o.sponsor_distributor_id = p_distributor_id
     AND o.kind <> 'distributor_signup'
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end;

  INSERT INTO gsv_snapshots (
    distributor_id, period_year, period_month,
    personal_bottles_sold, personal_sales_minor,
    team_gsv_minor, active_recruits_count, active_customers_count
  ) VALUES (
    p_distributor_id, p_year, p_month,
    v_personal_bottles, v_personal_sales,
    v_team_gsv, v_active_recruits, v_active_customers
  )
  ON CONFLICT (distributor_id, period_year, period_month) DO UPDATE SET
    personal_bottles_sold  = EXCLUDED.personal_bottles_sold,
    personal_sales_minor   = EXCLUDED.personal_sales_minor,
    team_gsv_minor         = EXCLUDED.team_gsv_minor,
    active_recruits_count  = EXCLUDED.active_recruits_count,
    active_customers_count = EXCLUDED.active_customers_count,
    computed_at            = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ----------------------------------------------------------------------
-- 4. is_distributor_qualified_for_rank — add the active-customers gate.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_distributor_qualified_for_rank(
  p_distributor_id BIGINT,
  p_rank_id        BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rank_team_minor    BIGINT;
  v_rank_min_actives   INT;
  v_rank_min_customers INT;
  v_team_gsv           BIGINT;
  v_active_recruits    INT;
  v_active_customers   INT;
  v_maintained         BOOLEAN;
BEGIN
  SELECT min_group_sales_minor, min_active_recruits, min_active_customers
    INTO v_rank_team_minor, v_rank_min_actives, v_rank_min_customers
    FROM config_ranks
   WHERE id = p_rank_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT team_gsv_minor, active_recruits_count, active_customers_count
    INTO v_team_gsv, v_active_recruits, v_active_customers
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
     AND v_active_recruits >= v_rank_min_actives
     AND (v_rank_min_customers IS NULL OR v_active_customers >= v_rank_min_customers);
END;
$function$;

-- ----------------------------------------------------------------------
-- 5. detect_rank_up — NULL-permissive filter so it never picks a rank
-- whose min_active_customers gate isn't met.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.detect_rank_up(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_period_end             TIMESTAMPTZ;
  v_team_gsv               BIGINT;
  v_active_recruits        INT;
  v_active_customers       INT;
  v_current_rank_position  INT := 1;
  v_target_rank_id         BIGINT;
  v_target_rank_position   INT;
  v_target_bonus_minor     BIGINT;
BEGIN
  v_period_end := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC')
                  + INTERVAL '1 month';

  SELECT team_gsv_minor, active_recruits_count, active_customers_count
    INTO v_team_gsv, v_active_recruits, v_active_customers
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
     AND (min_active_customers IS NULL OR min_active_customers <= v_active_customers)
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
$function$;

-- ----------------------------------------------------------------------
-- 6. Audit log
-- ----------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '031_e1_crown_president_active_customers',
  jsonb_build_object(
    'description',
    'E1 of deferred comp-engine items: Crown President requires 75 distinct retail customers per qualifying month. Adds config_ranks.min_active_customers and gsv_snapshots.active_customers_count, extends compute_gsv_snapshot / is_distributor_qualified_for_rank / detect_rank_up.',
    'crown_president_min_active_customers', 75,
    'ranks_unaffected', ARRAY[1,2,3,4]
  )
);

NOTIFY pgrst, 'reload schema';
