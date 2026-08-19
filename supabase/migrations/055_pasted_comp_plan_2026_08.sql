-- 055_pasted_comp_plan_2026_08.sql
--
-- Review-only migration draft for the pasted Loveli compensation plan.
-- This file is not applied automatically and must not be run against production
-- until the owner separately approves the database change.
--
-- Changes represented here:
--   * Registration fee: KES 900.
--   * 50ml PV: 500.
--   * Commission rates: L1-L5 = 20/11/6/2/1 percent; L6-L7 = 0.
--   * Five ranks: Ambassador, Active, Gold Director, Platinum Director,
--     Crown President.
--   * Active Direct thresholds: 5/30/40/60/120.
--   * Personal monthly bottles: 5/20/40/60/100.
--   * Group targets: KES 100,000 / 300,000 / 850,000 / 2,500,000 / 8,500,000.
--   * Rank-up qualifying months: 1/2/3/3/3. Missed months do not reset the
--     historical qualifying-month counter; the replacement count function below
--     counts qualifying months without requiring them to be consecutive.
--   * Active-customer gates are cleared because the pasted plan specifies
--     Active Directs, not active retail customers.
--
-- Not silently resolved here:
--   * The pasted plan says that higher rank does not automatically unlock
--     additional levels, while its rank benefits list L1, L1-L2, ... L1-L5.
--     The existing engine follows the rank-benefit table and caps level by rank.
--   * The pasted Day 1-10 maintenance rule requires a maintenance completion
--     date. The current schema has no dedicated maintenance event/date field;
--     the existing PV maintenance gate is therefore retained until that rule
--     is confirmed and implemented separately.

BEGIN;

DO $$
DECLARE
  v_now         TIMESTAMPTZ := NOW();
  v_package_id BIGINT;
BEGIN
  SELECT id
    INTO v_package_id
    FROM public.config_starter_packages
   WHERE effective_until IS NULL
   ORDER BY effective_from DESC
   LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'No active registration-fee configuration row found';
  END IF;

  UPDATE public.config_starter_packages
     SET effective_until = v_now
   WHERE id = v_package_id;

  INSERT INTO public.config_starter_packages (
    package_code,
    bundle_id,
    joining_fee_minor,
    effective_from
  )
  SELECT package_code, bundle_id, 90000, v_now
    FROM public.config_starter_packages
   WHERE id = v_package_id;
END $$;

UPDATE public.config_commission_rates
   SET effective_until = NOW()
 WHERE effective_until IS NULL;

INSERT INTO public.config_commission_rates (
  level,
  rate_basis_points,
  effective_from,
  notes
) VALUES
  (1, 2000, NOW(), 'Pasted plan: Level 1 = 20% of PV.'),
  (2, 1100, NOW(), 'Pasted plan: Level 2 = 11% of PV.'),
  (3,  600, NOW(), 'Pasted plan: Level 3 = 6% of PV.'),
  (4,  200, NOW(), 'Pasted plan: Level 4 = 2% of PV.'),
  (5,  100, NOW(), 'Pasted plan: Level 5 = 1% of PV.'),
  (6,    0, NOW(), 'Pasted plan defines five commission levels; Level 6 is disabled.'),
  (7,    0, NOW(), 'Pasted plan defines five commission levels; Level 7 is disabled.');

UPDATE public.config_ranks
   SET effective_until = NOW()
 WHERE effective_until IS NULL;

INSERT INTO public.config_ranks (
  rank_position,
  rank_name,
  emoji,
  min_active_recruits,
  min_group_sales_minor,
  rank_up_bonus_minor,
  min_personal_sales_minor,
  min_personal_pv,
  qualifying_months,
  min_active_customers,
  maintenance_grace_months,
  effective_from,
  notes
) VALUES
  (1, 'Ambassador',        NULL,   5,  10000000,   500000, 0,  2500, 1, NULL, NULL, NOW(), 'Pasted plan: 5 personal bottles, 5 Active Directs, KES 100,000 group target.'),
  (2, 'Active',            NULL,  30,  30000000,  1500000, 0, 10000, 2, NULL, NULL, NOW(), 'Pasted plan: 20 personal bottles, 30 Active Directs, KES 300,000 group target.'),
  (3, 'Gold Director',     NULL,  40,  85000000,  4000000, 0, 20000, 3, NULL, NULL, NOW(), 'Pasted plan: 40 personal bottles, 40 Active Directs, KES 850,000 group target.'),
  (4, 'Platinum Director', NULL,  60, 250000000, 12000000, 0, 30000, 3, NULL, NULL, NOW(), 'Pasted plan: 60 personal bottles, 60 Active Directs, KES 2,500,000 group target.'),
  (5, 'Crown President',   NULL, 120, 850000000, 30000000, 0, 50000, 3, NULL, NULL, NOW(), 'Pasted plan: 100 personal bottles, 120 Active Directs, KES 8,500,000 group target.');

UPDATE public.config_salary_tiers
   SET effective_until = NOW()
 WHERE effective_until IS NULL;

INSERT INTO public.config_salary_tiers (
  rank_position,
  min_personal_bottles,
  min_team_gsv_minor,
  fixed_salary_minor,
  performance_bonus_basis_points,
  effective_from
) VALUES
  (1,   5,  10000000,        0, 0, NOW()),
  (2,  20,  30000000,   500000, 0, NOW()),
  (3,  40,  85000000,  2000000, 0, NOW()),
  (4,  60, 250000000, 10000000, 0, NOW()),
  (5, 100, 850000000, 25000000, 0, NOW());

UPDATE public.product_variants
   SET pv_per_bottle = 500
 WHERE size_ml = 50;

-- CMS rows override code defaults on the public Partners page. Preserve all
-- unrelated editorial fields and replace only the stale plan language.
UPDATE public.site_content
   SET body = body || jsonb_build_object(
     'microtag', 'Five ranks - 50ml product - Grow through retail sales',
     'subhead', 'An invite-only partner program for people building a fragrance business in their area. Join with the registration fee and one or more perfumes, then grow through personal bottles, Active Directs and group volume.'
   )
 WHERE section_key = 'partner_landing';

UPDATE public.site_content
   SET body = body || jsonb_build_object(
     'tiersLead', 'Ranks are earned through personal bottles, Active Directs and group volume over time. They show progress in the business, not a promise of income.',
     'startHeadline', 'Join with the registration fee and one or more perfumes.'
   )
 WHERE section_key = 'partner_program';

-- Recalculate monthly snapshots with personal purchases based on the buyer's
-- distributor account. Personal purchases are removed from team GSV.
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
  v_user_id           UUID;
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

  SELECT user_id INTO v_user_id
    FROM public.distributors
   WHERE id = p_distributor_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'distributor % not found', p_distributor_id USING ERRCODE = 'no_data_found';
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COALESCE(SUM(oi.quantity), 0)
    INTO v_personal_bottles
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.user_id = v_user_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.variant_id IS NOT NULL;

  SELECT COALESCE(SUM(oi.commissionable_amount_minor), 0)::BIGINT
    INTO v_personal_sales
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.user_id = v_user_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.is_commissionable = TRUE;

  SELECT COALESCE(SUM(oi.commissionable_amount_minor), 0)::BIGINT
    INTO v_team_gsv
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.sponsor_distributor_id IN (
           SELECT descendant_id
             FROM public.distributor_tree
            WHERE ancestor_id = p_distributor_id
         )
     AND (o.user_id IS NULL OR o.user_id <> v_user_id)
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end
     AND oi.is_commissionable = TRUE;

  SELECT COUNT(DISTINCT d.id)
    INTO v_active_recruits
    FROM public.distributor_tree dt
    JOIN public.distributors d ON d.id = dt.descendant_id
   WHERE dt.ancestor_id = p_distributor_id
     AND dt.depth = 1
     AND d.is_active = TRUE
     AND EXISTS (
       SELECT 1
         FROM public.orders o
        WHERE o.sponsor_distributor_id = d.id
          AND o.status IN ('paid','fulfilled','shipped','delivered')
          AND o.paid_at >= v_period_start
          AND o.paid_at <  v_period_end
     );

  SELECT COUNT(DISTINCT COALESCE(o.user_id::text, o.customer_phone, o.customer_email::text))
    INTO v_active_customers
    FROM public.orders o
   WHERE o.sponsor_distributor_id = p_distributor_id
     AND o.kind <> 'distributor_signup'
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end;

  INSERT INTO public.gsv_snapshots (
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
    team_gsv_minor          = EXCLUDED.team_gsv_minor,
    active_recruits_count  = EXCLUDED.active_recruits_count,
    active_customers_count = EXCLUDED.active_customers_count,
    computed_at            = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Rank qualification uses the target rank's personal PV, Active Directs,
-- group volume, and maintenance gate. The active-customer column is retained
-- for schema compatibility but all current rows set it to NULL.
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
AS $function$
DECLARE
  v_rank_team_minor    BIGINT;
  v_rank_min_actives   INT;
  v_rank_min_pv        INT;
  v_rank_min_customers INT;
  v_user_id            UUID;
  v_period_start       TIMESTAMPTZ;
  v_period_end         TIMESTAMPTZ;
  v_personal_pv        BIGINT;
  v_team_gsv           BIGINT;
  v_active_recruits    INT;
  v_active_customers   INT;
  v_maintained         BOOLEAN;
BEGIN
  SELECT min_group_sales_minor, min_active_recruits, min_personal_pv,
         min_active_customers
    INTO v_rank_team_minor, v_rank_min_actives, v_rank_min_pv,
         v_rank_min_customers
    FROM public.config_ranks
   WHERE id = p_rank_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT d.user_id, gs.team_gsv_minor, gs.active_recruits_count,
         gs.active_customers_count
    INTO v_user_id, v_team_gsv, v_active_recruits, v_active_customers
    FROM public.distributors d
    LEFT JOIN public.gsv_snapshots gs
      ON gs.distributor_id = d.id
     AND gs.period_year = p_year
     AND gs.period_month = p_month
   WHERE d.id = p_distributor_id;
  IF v_user_id IS NULL OR v_team_gsv IS NULL THEN
    RETURN FALSE;
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COALESCE(SUM(oi.commission_pv), 0)::BIGINT
    INTO v_personal_pv
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.user_id = v_user_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end;

  v_maintained := public.is_distributor_maintained(
    p_distributor_id, p_year, p_month
  );
  IF NOT v_maintained THEN
    RETURN FALSE;
  END IF;

  RETURN v_personal_pv >= COALESCE(v_rank_min_pv, 0)
     AND v_team_gsv >= v_rank_team_minor
     AND v_active_recruits >= v_rank_min_actives
     AND (v_rank_min_customers IS NULL OR v_active_customers >= v_rank_min_customers);
END;
$function$;

-- Monthly lifestyle bonus requires the rank's personal bottles, Active Directs,
-- and group target for the month. Rank-up bonuses remain controlled by
-- detect_rank_up and qualifying_months.
CREATE OR REPLACE FUNCTION public.compute_monthly_salary(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_period_end       TIMESTAMPTZ;
  v_personal_bottles INT;
  v_team_gsv         BIGINT;
  v_active_recruits  INT;
  v_rank_id          BIGINT;
  v_rank_position    INT;
  v_min_directs      INT := 0;
  v_tier_min_bottles INT := 0;
  v_tier_min_gsv     BIGINT := 0;
  v_tier_fixed       BIGINT := 0;
  v_tier_bp          INT := 0;
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

  SELECT personal_bottles_sold, team_gsv_minor, active_recruits_count
    INTO v_personal_bottles, v_team_gsv, v_active_recruits
    FROM public.gsv_snapshots
   WHERE distributor_id = p_distributor_id
     AND period_year   = p_year
     AND period_month  = p_month;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gsv snapshot missing for distributor % %-%; run compute_gsv_snapshot first',
      p_distributor_id, p_year, p_month
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT current_rank_id INTO v_rank_id
    FROM public.distributors
   WHERE id = p_distributor_id;

  IF v_rank_id IS NULL THEN
    SELECT id INTO v_rank_id
      FROM public.config_ranks
     WHERE rank_position = 1
       AND effective_until IS NULL
     ORDER BY effective_from DESC LIMIT 1;
  END IF;

  SELECT rank_position, min_active_recruits
    INTO v_rank_position, v_min_directs
    FROM public.config_ranks
   WHERE id = v_rank_id;
  v_rank_position := COALESCE(v_rank_position, 1);
  v_min_directs := COALESCE(v_min_directs, 0);

  SELECT min_personal_bottles, min_team_gsv_minor,
         fixed_salary_minor, performance_bonus_basis_points
    INTO v_tier_min_bottles, v_tier_min_gsv, v_tier_fixed, v_tier_bp
    FROM public.config_salary_tiers
   WHERE rank_position = v_rank_position
     AND effective_from <= v_period_end
     AND (effective_until IS NULL OR effective_until > v_period_end)
   ORDER BY effective_from DESC LIMIT 1;

  IF FOUND THEN
    v_qualified := v_personal_bottles >= v_tier_min_bottles
               AND v_active_recruits >= v_min_directs
               AND v_team_gsv >= v_tier_min_gsv;
    IF v_qualified THEN
      v_fixed := v_tier_fixed;
      IF v_team_gsv > v_tier_min_gsv AND v_tier_bp > 0 THEN
        v_perf := ((v_team_gsv - v_tier_min_gsv) * v_tier_bp) / 10000;
      END IF;
      v_total := v_fixed + v_perf;
    END IF;
  END IF;

  SELECT id, payout_id INTO v_existing_id, v_existing_payout
    FROM public.monthly_salaries
   WHERE distributor_id = p_distributor_id
     AND period_year = p_year
     AND period_month = p_month;

  IF FOUND AND v_existing_payout IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  INSERT INTO public.monthly_salaries (
    distributor_id, period_year, period_month,
    rank_at_period_id, personal_bottles_sold, team_gsv_minor,
    qualified, fixed_salary_minor, performance_bonus_minor, total_minor
  ) VALUES (
    p_distributor_id, p_year, p_month,
    v_rank_id, v_personal_bottles, v_team_gsv,
    v_qualified, v_fixed, v_perf, v_total
  )
  ON CONFLICT (distributor_id, period_year, period_month) DO UPDATE SET
    rank_at_period_id = EXCLUDED.rank_at_period_id,
    personal_bottles_sold = EXCLUDED.personal_bottles_sold,
    team_gsv_minor = EXCLUDED.team_gsv_minor,
    qualified = EXCLUDED.qualified,
    fixed_salary_minor = EXCLUDED.fixed_salary_minor,
    performance_bonus_minor = EXCLUDED.performance_bonus_minor,
    total_minor = EXCLUDED.total_minor,
    computed_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- The pasted plan says a missed month does not reset the accumulated counter.
-- Keep the existing function signature for detect_rank_up compatibility, but
-- count qualifying months across all available history up to the requested
-- period instead of stopping at the first missed month.
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
AS $function$
DECLARE
  v_count INT := 0;
  rec RECORD;
BEGIN
  IF p_max <= 0 THEN
    RETURN 0;
  END IF;

  FOR rec IN
    SELECT period_year, period_month
      FROM public.gsv_snapshots
     WHERE distributor_id = p_distributor_id
       AND (
         period_year < p_ending_year
         OR (period_year = p_ending_year AND period_month <= p_ending_month)
       )
     ORDER BY period_year, period_month
  LOOP
    IF public.is_distributor_qualified_for_rank(
      p_distributor_id,
      p_target_rank_id,
      rec.period_year,
      rec.period_month
    ) THEN
      v_count := v_count + 1;
      EXIT WHEN v_count >= p_max;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

INSERT INTO public.audit_log (actor_id, action, resource_type, resource_id, after_data)
VALUES (
  NULL,
  'migration.draft_comp_plan_pasted',
  'compensation_plan',
  '055_pasted_comp_plan_2026_08',
  jsonb_build_object(
    'registration_fee_kes', 900,
    'product_50ml_pv', 500,
    'commission_rates', jsonb_build_array(20, 11, 6, 2, 1),
    'rank_names', jsonb_build_array('Ambassador', 'Active', 'Gold Director', 'Platinum Director', 'Crown President'),
    'active_directs', jsonb_build_array(5, 30, 40, 60, 120),
    'personal_bottles', jsonb_build_array(5, 20, 40, 60, 100),
    'group_targets_kes', jsonb_build_array(100000, 300000, 850000, 2500000, 8500000),
    'note', 'Review-only draft. Do not apply until owner approves database changes and resolves maintenance/rank-unlock ambiguities.'
  )
);

NOTIFY pgrst, 'reload schema';

COMMIT;
