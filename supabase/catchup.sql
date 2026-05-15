-- =============================================================================
-- LOVELI LUXURY — CONSOLIDATED CATCHUP MIGRATION
-- =============================================================================
-- One-shot paste that brings a partially-migrated DB to the same end state
-- as applying migrations 004-012, 016-018 individually. Skips 013 (superseded
-- by 014) and 014-015 (already applied).
--
-- Every statement uses CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT
-- DO NOTHING so re-running is safe.
-- =============================================================================

-- >>> migrations/004_commission_ledger.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMMISSION LEDGER WRITE RPC
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      004_commission_ledger.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 4 wave 1, step 1.
--                 write_commission_ledger(order_id) — fans out a paid order's
--                 commissionable basis up to 7 levels of the sponsor's upline,
--                 referencing the active config_commission_rates rows at the
--                 order's paid_at timestamp. Idempotent: a second call against
--                 the same order is a no-op.
-- Math:           amount_minor = (basis_minor * rate_basis_points) / 10000
--                 Integer division truncates toward zero, matching the JS
--                 commission-calculator used in unit tests as the spec.
-- Tree walk:      The buyer's sponsor (orders.sponsor_distributor_id) is
--                 LEVEL 1. The sponsor's direct upline is LEVEL 2, and so on
--                 to LEVEL 7. We read this directly off the closure table by
--                 selecting ancestors of the sponsor with depth 0..6 and
--                 mapping depth → level via depth + 1.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- write_commission_ledger
-- -----------------------------------------------------------------------------
-- Returns:
--   The number of commission_ledger rows inserted by this call. 0 means
--   either the order has no sponsor, has no commissionable basis, has
--   already been processed, or no rate configuration was found for any
--   level.
--
-- Raises:
--   - 'no_data_found' if the order does not exist
--   - 'order_not_paid' if the order is not in 'paid' state
--
-- Failure semantics:
--   This function is INTENDED to be called after mark_order_paid returns
--   TRUE. If it errors, the order itself remains paid — commissions are
--   derivative and can be backfilled. Webhook callers should return non-2xx
--   so Flutterwave retries.

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
  v_existing              INT;
  v_count                 INT := 0;
  rec                     RECORD;
  v_rate_id               BIGINT;
  v_rate_bp               INT;
  v_amount                BIGINT;
BEGIN
  -- Load the order
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

  -- No sponsor → no commissions to write. Common for retail orders that
  -- arrived without a ?ref= referral. Not an error.
  IF v_sponsor_distributor IS NULL THEN
    RETURN 0;
  END IF;

  -- Idempotency guard: a previous call already wrote rows for this order.
  -- Cheaper than re-walking the tree just to discover duplicates at insert.
  SELECT COUNT(*) INTO v_existing
    FROM commission_ledger
   WHERE source_order_id = p_order_id;
  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  -- Commissionable basis = sum of distributor-price-times-quantity across
  -- all line items on the order. Set at order creation in checkout/init.
  SELECT COALESCE(SUM(commissionable_amount_minor), 0)::BIGINT
    INTO v_basis_minor
    FROM order_items
   WHERE order_id = p_order_id
     AND is_commissionable = TRUE;

  IF v_basis_minor = 0 THEN
    RETURN 0;
  END IF;

  -- Defensive: paid_at should be non-null when status='paid', but tolerate
  -- a NULL by falling back to NOW() so rate lookup still works.
  v_paid_at := COALESCE(v_paid_at, NOW());

  -- Walk: sponsor itself (depth 0) becomes level 1; sponsor's upline at
  -- depths 1..6 becomes levels 2..7. The closure table's self-row at
  -- depth 0 is what makes this clean.
  FOR rec IN
    SELECT
      dt.ancestor_id  AS recipient_distributor_id,
      dt.depth + 1    AS commission_level
      FROM distributor_tree dt
     WHERE dt.descendant_id = v_sponsor_distributor
       AND dt.depth BETWEEN 0 AND 6
     ORDER BY dt.depth ASC
  LOOP
    -- Active rate for this level at the time the order was paid. We pick
    -- the most recent effective_from on or before paid_at, with no
    -- effective_until (or one strictly after paid_at).
    SELECT id, rate_basis_points
      INTO v_rate_id, v_rate_bp
      FROM config_commission_rates
     WHERE level = rec.commission_level
       AND effective_from <= v_paid_at
       AND (effective_until IS NULL OR effective_until > v_paid_at)
     ORDER BY effective_from DESC
     LIMIT 1;

    IF v_rate_id IS NULL THEN
      -- Level not configured at this point in time. Skip silently — config
      -- changes mid-month should not break commission writing for the
      -- levels that ARE configured.
      CONTINUE;
    END IF;

    -- Integer truncation toward zero. Matches Phase 1 JS calculator and
    -- the documented payout rounding in the comp plan.
    v_amount := (v_basis_minor * v_rate_bp) / 10000;

    -- Skip zero-amount rows (defensive for very small bases). The CHECK on
    -- amount_minor accepts 0, so this is a cleanliness choice not a
    -- constraint workaround.
    IF v_amount = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO commission_ledger (
      distributor_id,
      source_order_id,
      source_distributor_id,
      level,
      commission_basis_minor,
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
      v_rate_bp,
      v_amount,
      'KES',
      v_rate_id,
      v_paid_at
    );
    v_count := v_count + 1;
  END LOOP;

  -- Audit trail. actor_id is null because this runs from a webhook /
  -- service-role context, not on behalf of an end user.
  INSERT INTO audit_log (
    actor_id, action, resource_type, resource_id, after_data
  ) VALUES (
    NULL,
    'commission.ledger_written',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'rows_written',          v_count,
      'basis_minor',           v_basis_minor,
      'sponsor_distributor_id', v_sponsor_distributor
    )
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_commission_ledger(BIGINT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 004
-- =============================================================================

-- >>> migrations/005_provision_distributor.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — PROVISION DISTRIBUTOR ON SIGNUP PAID
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      005_provision_distributor.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 4 wave 1, step 3.
--                 provision_distributor(order_id) — converts a paid
--                 distributor_signup order into a distributors row +
--                 closure-tree insertion + role grant. Idempotent: a second
--                 call for the same user_id returns the existing row.
-- Invite-only:    Refuses to provision if the order has no
--                 sponsor_distributor_id, or if the sponsor is inactive.
--                 The application layer is the first gate (see
--                 /api/distributor-signup/init); this is the second.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- provision_distributor
-- -----------------------------------------------------------------------------
-- Returns:
--   The distributors.id of the new (or pre-existing) distributor.
--
-- Raises:
--   - 'no_data_found' if the order doesn't exist
--   - 'invalid_parameter_value' if the order isn't a paid distributor_signup
--     or the sponsor is missing/inactive
--
-- Side effects on success:
--   - INSERT into distributors with starter_paid_at = order.paid_at
--   - INSERT into distributor_tree via add_distributor_to_tree()
--   - INSERT into user_roles with role='distributor' (if not already granted)
--   - INSERT audit_log row

CREATE OR REPLACE FUNCTION public.provision_distributor(p_order_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status                order_status;
  v_kind                  order_kind;
  v_user_id               UUID;
  v_sponsor_distributor   BIGINT;
  v_paid_at               TIMESTAMPTZ;
  v_notes                 TEXT;
  v_signup                JSONB;
  v_starter_bundle_id     BIGINT;
  v_payout_msisdn         TEXT;
  v_national_id           TEXT;
  v_dob                   DATE;
  v_sponsor_active        BOOLEAN;
  v_existing              BIGINT;
  v_new_distributor       BIGINT;
  v_sponsor_code          TEXT;
  v_attempts              INT := 0;
BEGIN
  SELECT status, kind, user_id, sponsor_distributor_id, paid_at, notes
    INTO v_status, v_kind, v_user_id, v_sponsor_distributor, v_paid_at, v_notes
    FROM orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_kind <> 'distributor_signup' THEN
    RAISE EXCEPTION 'order % is not a distributor_signup (kind=%)', p_order_id, v_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_status <> 'paid' THEN
    RAISE EXCEPTION 'order % is not paid (status=%)', p_order_id, v_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'order % has no user_id (guest signup not supported)', p_order_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Invite-only guard #2 (the API route is guard #1)
  IF v_sponsor_distributor IS NULL THEN
    RAISE EXCEPTION 'order % has no sponsor_distributor_id; signup is invite-only', p_order_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT is_active INTO v_sponsor_active
    FROM distributors
   WHERE id = v_sponsor_distributor;
  IF NOT FOUND OR v_sponsor_active IS NOT TRUE THEN
    RAISE EXCEPTION 'sponsor distributor % is missing or inactive', v_sponsor_distributor
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Idempotency: same user already has a distributors row → return it
  SELECT id INTO v_existing FROM distributors WHERE user_id = v_user_id;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Pull KYC fields from the orders.notes JSON blob (set by the signup
  -- init route). We tolerate missing keys to keep the function robust to
  -- format changes; only the starter_bundle_id is strictly required so we
  -- can populate distributors.starter_package_id.
  IF v_notes IS NOT NULL AND length(v_notes) > 0 THEN
    BEGIN
      v_signup := v_notes::JSONB -> 'signup';
    EXCEPTION WHEN others THEN
      v_signup := NULL;
    END;
  END IF;

  IF v_signup IS NOT NULL THEN
    v_starter_bundle_id := NULLIF(v_signup ->> 'starter_bundle_id', '')::BIGINT;
    v_payout_msisdn     := v_signup ->> 'payout_msisdn';
    v_national_id       := v_signup ->> 'national_id';
    BEGIN
      v_dob := (v_signup ->> 'date_of_birth')::DATE;
    EXCEPTION WHEN others THEN
      v_dob := NULL;
    END;
  END IF;

  -- Fall back to scanning order_items for the bundle_id if notes is silent.
  IF v_starter_bundle_id IS NULL THEN
    SELECT bundle_id INTO v_starter_bundle_id
      FROM order_items
     WHERE order_id = p_order_id
       AND bundle_id IS NOT NULL
     ORDER BY id ASC
     LIMIT 1;
  END IF;

  -- Mint a unique sponsor_code. generate_sponsor_code() is non-cryptographic
  -- and could in theory collide with an existing one. Retry up to a small
  -- bound; surfacing the rare error is preferable to silently looping.
  LOOP
    v_attempts := v_attempts + 1;
    v_sponsor_code := public.generate_sponsor_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM distributors WHERE sponsor_code = v_sponsor_code
    );
    IF v_attempts >= 12 THEN
      RAISE EXCEPTION 'could not generate a unique sponsor_code after % attempts', v_attempts;
    END IF;
  END LOOP;

  -- Update the profile with KYC-side fields when we have them. Doing this
  -- here keeps the profile consistent with the distributors row we're about
  -- to insert without forcing the API route to mutate profiles before the
  -- order is paid.
  IF v_national_id IS NOT NULL OR v_dob IS NOT NULL THEN
    UPDATE profiles
       SET national_id   = COALESCE(v_national_id, national_id),
           date_of_birth = COALESCE(v_dob, date_of_birth)
     WHERE id = v_user_id;
  END IF;

  INSERT INTO distributors (
    user_id,
    sponsor_code,
    sponsor_id,
    is_active,
    starter_package_id,
    starter_paid_at,
    payout_msisdn,
    payout_msisdn_verified_at,
    kyc_status
  ) VALUES (
    v_user_id,
    v_sponsor_code,
    v_sponsor_distributor,
    TRUE,
    v_starter_bundle_id,
    v_paid_at,
    v_payout_msisdn,
    -- A real verification step (e.g. STK push to confirm ownership) is a
    -- Phase 5 enhancement. For now we trust the entered number but stamp
    -- it as verified-on-payment so payouts can be initiated.
    v_paid_at,
    'pending'
  )
  RETURNING id INTO v_new_distributor;

  -- Closure-tree insertion: self-row at depth 0 plus inherited ancestors
  -- from the sponsor up to depth 7.
  PERFORM public.add_distributor_to_tree(v_new_distributor, v_sponsor_distributor);

  -- Role grant. UNIQUE(user_id, role) on user_roles makes this idempotent
  -- with ON CONFLICT.
  INSERT INTO user_roles (user_id, role, granted_at)
  VALUES (v_user_id, 'distributor', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO audit_log (
    actor_id, action, resource_type, resource_id, after_data
  ) VALUES (
    NULL,
    'distributor.provisioned',
    'distributors',
    v_new_distributor::TEXT,
    jsonb_build_object(
      'order_id',     p_order_id,
      'user_id',      v_user_id,
      'sponsor_id',   v_sponsor_distributor,
      'sponsor_code', v_sponsor_code
    )
  );

  RETURN v_new_distributor;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_distributor(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_distributor(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_distributor(BIGINT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 005
-- =============================================================================

-- >>> migrations/006_monthly_close.sql <<<
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

-- >>> migrations/007_refund_inventory.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — REFUND INVENTORY RESTORE
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      007_refund_inventory.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 4 wave 3.
--                 restore_order_inventory(order_id) — mirrors the variant
--                 + bundle-expanded decrement that mark_order_paid performs,
--                 but adds back. Called by the admin refund action AFTER
--                 a successful Flutterwave refund API response. The order's
--                 status flip to 'refunded' happens in the same transaction
--                 in the calling Server Action (not here) so the action
--                 retains responsibility for ordering with the FW call.
-- Scope:          Inventory restore is allowed for paid|fulfilled|shipped
--                 only. 'delivered' refunds are a manager override deferred
--                 to Phase 5 (the customer already has the goods; restocking
--                 needs a physical-return workflow that this project doesn't
--                 model yet).
-- Idempotency:    The function records an audit_log row keyed on
--                 (order.refunded_at). On second invocation it would
--                 double-restock, so it raises if the order is already in
--                 'refunded' status. Callers must check status first.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.restore_order_inventory(p_order_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status order_status;
BEGIN
  SELECT status INTO v_status
    FROM orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status NOT IN ('paid', 'fulfilled', 'shipped') THEN
    RAISE EXCEPTION
      'order % cannot be inventory-restored from status % (allowed: paid, fulfilled, shipped)',
      p_order_id, v_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Add back inventory for direct variant lines
  UPDATE product_variants pv
     SET inventory_qty = pv.inventory_qty + oi.quantity
    FROM order_items oi
   WHERE oi.order_id = p_order_id
     AND oi.variant_id = pv.id;

  -- Add back inventory for bundle-expanded variants
  UPDATE product_variants pv
     SET inventory_qty = pv.inventory_qty + delta.total_qty
    FROM (
      SELECT bi.variant_id, SUM(oi.quantity * bi.quantity)::INT AS total_qty
        FROM order_items oi
        JOIN bundle_items bi ON bi.bundle_id = oi.bundle_id
       WHERE oi.order_id = p_order_id
         AND oi.bundle_id IS NOT NULL
       GROUP BY bi.variant_id
    ) delta
   WHERE delta.variant_id = pv.id;

  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'order.inventory_restored',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object('previous_status', v_status)
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_order_inventory(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_order_inventory(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_order_inventory(BIGINT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 007
-- =============================================================================

-- >>> migrations/008_commission_clawback.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMMISSION CLAW-BACK ON REFUND
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      008_commission_clawback.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 5 wave 1.
--                 void_unpaid_commissions_for_order(order_id) — when an
--                 order is refunded we must not pay the commissions it
--                 generated. This RPC DELETEs commission_ledger rows for
--                 the order that have not yet been attached to a payout
--                 (payout_id IS NULL), and reports any that were already
--                 paid out so the admin/UI can surface a manager warning.
-- Policy:         Phase 5 deliberately does NOT auto-claw-back paid
--                 commissions. Reversing a row already disbursed via
--                 M-Pesa requires a chargeback flow + accounting policy
--                 that varies by jurisdiction. We surface the count so a
--                 human can resolve.
-- Idempotency:    Re-running on the same order is a no-op for both
--                 voided rows (already deleted) and paid rows (count is
--                 stable until a manual reconciliation action runs).
-- =============================================================================


CREATE OR REPLACE FUNCTION public.void_unpaid_commissions_for_order(p_order_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voided          INT := 0;
  v_voided_amount   BIGINT := 0;
  v_already_paid    INT := 0;
  v_paid_amount     BIGINT := 0;
BEGIN
  -- Aggregate the unpaid block first so the audit log + return value are
  -- accurate even though we'll delete them right after.
  SELECT COUNT(*), COALESCE(SUM(amount_minor), 0)::BIGINT
    INTO v_voided, v_voided_amount
    FROM commission_ledger
   WHERE source_order_id = p_order_id
     AND payout_id IS NULL;

  -- Aggregate the already-paid block so we can surface the warning.
  SELECT COUNT(*), COALESCE(SUM(amount_minor), 0)::BIGINT
    INTO v_already_paid, v_paid_amount
    FROM commission_ledger
   WHERE source_order_id = p_order_id
     AND payout_id IS NOT NULL;

  IF v_voided > 0 THEN
    DELETE FROM commission_ledger
     WHERE source_order_id = p_order_id
       AND payout_id IS NULL;
  END IF;

  -- One audit row per call, regardless of whether we voided anything.
  -- Distinguishing "no commissions existed" from "they were all paid"
  -- matters for ops, so include both numbers explicitly.
  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'commission.clawback',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'voided_count',         v_voided,
      'voided_amount_minor',  v_voided_amount,
      'already_paid_count',   v_already_paid,
      'already_paid_minor',   v_paid_amount
    )
  );

  RETURN jsonb_build_object(
    'voided',              v_voided,
    'voided_amount_minor', v_voided_amount,
    'already_paid',        v_already_paid,
    'paid_amount_minor',   v_paid_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_unpaid_commissions_for_order(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_unpaid_commissions_for_order(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.void_unpaid_commissions_for_order(BIGINT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 008
-- =============================================================================

-- >>> migrations/009_commission_compression.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMMISSION COMPRESSION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      009_commission_compression.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 5 wave 2.
--                 Adds a small key/value config_settings table for runtime
--                 policy flags, seeds `commission_compression_enabled =
--                 false` (opt-in by default), and replaces
--                 write_commission_ledger() with a version that honours
--                 the flag.
-- Compression:    When enabled, inactive distributors in the upline are
--                 skipped and the next active ancestor is promoted to
--                 their level slot. We deliberately do NOT extend the
--                 chain beyond the existing closure-table cap of depth 7
--                 — if there aren't enough active ancestors in the
--                 visible chain, fewer levels get paid. Extending the
--                 closure cap (and therefore the recursive compression
--                 reach) is a Phase 6 schema change.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. config_settings — generic key/value flags for runtime policy
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS config_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  notes       TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE config_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read settings (so the app can branch on them).
-- Only superadmin writes.
DROP POLICY IF EXISTS config_settings_read ON config_settings;
CREATE POLICY config_settings_read
  ON config_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS config_settings_super ON config_settings;
CREATE POLICY config_settings_super
  ON config_settings FOR ALL
  USING (has_role('superadmin'));

-- Helper: read a boolean setting with a default.
CREATE OR REPLACE FUNCTION public.get_setting_bool(
  p_key TEXT, p_default BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v JSONB;
BEGIN
  SELECT value INTO v FROM config_settings WHERE key = p_key;
  IF NOT FOUND OR v IS NULL THEN
    RETURN p_default;
  END IF;
  -- Accept either a bare boolean or the strings "true"/"false"
  IF jsonb_typeof(v) = 'boolean' THEN
    RETURN v::TEXT::BOOLEAN;
  ELSIF jsonb_typeof(v) = 'string' THEN
    RETURN (v #>> '{}')::BOOLEAN;
  ELSE
    RETURN p_default;
  END IF;
EXCEPTION WHEN others THEN
  RETURN p_default;
END;
$$;

-- Seed the compression flag in the OFF position so behaviour is unchanged
-- until a superadmin opts in.
INSERT INTO config_settings (key, value, notes)
VALUES (
  'commission_compression_enabled',
  to_jsonb(FALSE),
  'When TRUE, write_commission_ledger skips inactive ancestors and promotes the next active up to fill the level slot. Defaults FALSE.'
)
ON CONFLICT (key) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. write_commission_ledger v2 — honour compression flag
-- -----------------------------------------------------------------------------
-- Replaces the migration-004 body. Signature unchanged.
--
-- Algorithm:
--   - Build the chain: ancestors of the buyer's sponsor at depth 0..6.
--   - If compression is OFF: level = chain_depth + 1 (sponsor=L1, etc.)
--     for every row, regardless of is_active. (Original behaviour.)
--   - If compression is ON: filter to active ancestors only, then
--     ROW_NUMBER() over chain_depth → that becomes the level. Inactives
--     get no row.
--
-- Result rows still pass through the same rate-lookup + integer math as
-- before. Idempotency on source_order_id is preserved.

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
  v_existing              INT;
  v_count                 INT := 0;
  v_compression_enabled   BOOLEAN;
  rec                     RECORD;
  v_rate_id               BIGINT;
  v_rate_bp               INT;
  v_amount                BIGINT;
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

  SELECT COALESCE(SUM(commissionable_amount_minor), 0)::BIGINT
    INTO v_basis_minor
    FROM order_items
   WHERE order_id = p_order_id
     AND is_commissionable = TRUE;

  IF v_basis_minor = 0 THEN
    RETURN 0;
  END IF;

  v_paid_at := COALESCE(v_paid_at, NOW());
  v_compression_enabled := public.get_setting_bool(
    'commission_compression_enabled', FALSE
  );

  -- Build the recipient list. Two query variants gated on the flag, both
  -- producing rows of (recipient_distributor_id, commission_level).
  FOR rec IN
    WITH chain AS (
      SELECT dt.ancestor_id, dt.depth AS chain_depth, d.is_active
        FROM distributor_tree dt
        JOIN distributors    d  ON d.id = dt.ancestor_id
       WHERE dt.descendant_id = v_sponsor_distributor
         AND dt.depth BETWEEN 0 AND 6
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

    v_amount := (v_basis_minor * v_rate_bp) / 10000;
    IF v_amount = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO commission_ledger (
      distributor_id,
      source_order_id,
      source_distributor_id,
      level,
      commission_basis_minor,
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
      'basis_minor',           v_basis_minor,
      'sponsor_distributor_id', v_sponsor_distributor,
      'compression_enabled',   v_compression_enabled
    )
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_commission_ledger(BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.get_setting_bool(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_setting_bool(TEXT, BOOLEAN) TO authenticated, service_role;

-- =============================================================================
-- END OF MIGRATION 009
-- =============================================================================

-- >>> migrations/010_msisdn_change.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MSISDN CHANGE FLOW
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      010_msisdn_change.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 6 wave 1.
--                 Adds two columns to distributors so a distributor can
--                 submit a new payout M-Pesa number that an admin then
--                 verifies before payouts can fire to it. Channel-
--                 agnostic — the actual SMS / STK-push verification is
--                 deferred to a later phase; an admin manually approves
--                 in the meantime.
-- Flow:
--   1. Distributor submits a new MSISDN from the portal:
--        UPDATE distributors
--           SET payout_msisdn_pending     = '+254...',
--               payout_msisdn_pending_at  = NOW()
--      AND we also clear payout_msisdn_verified_at so any pending
--      payouts cannot fire (Phase 5's payout-init guard handles this).
--   2. Admin reviews on /admin/distributors/verifications:
--        UPDATE distributors
--           SET payout_msisdn               = pending,
--               payout_msisdn_verified_at   = NOW(),
--               payout_msisdn_pending       = NULL,
--               payout_msisdn_pending_at    = NULL
--   3. New payouts can be drafted/initiated against the verified number.
-- =============================================================================


ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS payout_msisdn_pending     TEXT,
  ADD COLUMN IF NOT EXISTS payout_msisdn_pending_at  TIMESTAMPTZ;

-- Partial index — pending verifications surface fast for the admin queue.
CREATE INDEX IF NOT EXISTS idx_distributors_msisdn_pending
  ON distributors(payout_msisdn_pending_at DESC)
  WHERE payout_msisdn_pending IS NOT NULL;

-- =============================================================================
-- END OF MIGRATION 010
-- =============================================================================

-- >>> migrations/011_clawback_resolutions.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — CLAWBACK RESOLUTIONS
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      011_clawback_resolutions.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 6 wave 2.
--                 Tracks the workflow status of refunded orders whose
--                 commission_ledger rows were already paid out by the
--                 time the refund happened. The migration-008 RPC voids
--                 the UNPAID rows automatically; everything that was
--                 already disbursed needs a human decision: write off
--                 the loss, or queue a deduction against a future
--                 payout. This table is that workflow.
-- =============================================================================


CREATE TABLE IF NOT EXISTS clawback_resolutions (
  id                          BIGSERIAL PRIMARY KEY,
  order_id                    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  paid_amount_minor           BIGINT NOT NULL CHECK (paid_amount_minor >= 0),
  paid_count                  INT    NOT NULL CHECK (paid_count       >= 0),
  resolution                  TEXT,
  deducted_from_payout_id     BIGINT REFERENCES payouts(id),
  notes                       TEXT,
  resolved_by                 UUID   REFERENCES profiles(id),
  resolved_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id),
  CHECK (
    resolution IS NULL
    OR resolution IN ('written_off', 'deducted_from_payout')
  ),
  -- If a payout id is referenced, the resolution must be the matching kind.
  CHECK (
    (deducted_from_payout_id IS NULL)
    OR (resolution = 'deducted_from_payout')
  ),
  -- A resolution decision implies a resolver + timestamp.
  CHECK (
    (resolution IS NULL AND resolved_at IS NULL)
    OR (resolution IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_clawback_pending
  ON clawback_resolutions(created_at DESC)
  WHERE resolution IS NULL;

ALTER TABLE clawback_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clawback_admin ON clawback_resolutions;
CREATE POLICY clawback_admin
  ON clawback_resolutions FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- =============================================================================
-- END OF MIGRATION 011
-- =============================================================================

-- >>> migrations/012_closure_table_extension.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — CLOSURE TABLE EXTENSION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      012_closure_table_extension.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 6 wave 3.
--                 Bumps the closure-table depth cap from 7 to 14 so the
--                 compressed-commissions code path has a deeper chain
--                 to walk. Plain (non-compressed) commissions still only
--                 pay 7 levels — the seed config_commission_rates only
--                 covers L1..L7. The deeper rows just give compression
--                 a chance to skip past inactives and still find 7 active
--                 ancestors.
-- Backfill:       For tables already populated, the deeper rows must be
--                 generated. We add an idempotent
--                 rebuild_distributor_tree_for(distributor_id) helper
--                 and call it for every existing distributor at the end
--                 of the migration. The helper uses
--                 ON CONFLICT DO UPDATE so re-running is safe.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Lift the depth CHECK constraint
-- -----------------------------------------------------------------------------
-- Postgres assigns a generated name to the inline CHECK from the original
-- CREATE TABLE. We drop by name with IF EXISTS guards (the name varies by
-- Postgres version; both common defaults are tried).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.distributor_tree'::regclass
       AND contype = 'c'
       AND conname  = 'distributor_tree_depth_check'
  ) THEN
    ALTER TABLE distributor_tree DROP CONSTRAINT distributor_tree_depth_check;
  END IF;
END $$;

-- Drop any other inline CHECK on the column, just in case.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.distributor_tree'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%depth%'
  LOOP
    EXECUTE format('ALTER TABLE distributor_tree DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE distributor_tree
  ADD CONSTRAINT distributor_tree_depth_check
    CHECK (depth BETWEEN 0 AND 14);


-- -----------------------------------------------------------------------------
-- 2. add_distributor_to_tree — extend the cap
-- -----------------------------------------------------------------------------
-- Same shape as the original migration-001 helper, just with the cap bumped
-- to 14. Self-row at depth 0 plus inherited ancestors from the parent.

CREATE OR REPLACE FUNCTION public.add_distributor_to_tree(
  p_new_distributor_id    BIGINT,
  p_parent_distributor_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
  VALUES (p_new_distributor_id, p_new_distributor_id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

  IF p_parent_distributor_id IS NOT NULL THEN
    INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
    SELECT t.ancestor_id, p_new_distributor_id, t.depth + 1
      FROM distributor_tree t
     WHERE t.descendant_id = p_parent_distributor_id
       AND t.depth + 1 <= 14
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE
      SET depth = EXCLUDED.depth;
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. rebuild_distributor_tree_for — backfill helper
-- -----------------------------------------------------------------------------
-- Walks up sponsor_id from a distributor and inserts/refreshes every
-- ancestor row up to depth 14. Idempotent. Returns the number of
-- ancestor rows touched (excluding the self-row).

CREATE OR REPLACE FUNCTION public.rebuild_distributor_tree_for(p_distributor_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INT := 0;
  v_current BIGINT;
  v_depth   INT := 0;
BEGIN
  -- Self-row
  INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
  VALUES (p_distributor_id, p_distributor_id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = 0;

  SELECT sponsor_id INTO v_current FROM distributors WHERE id = p_distributor_id;
  WHILE v_current IS NOT NULL AND v_depth < 14 LOOP
    v_depth := v_depth + 1;
    INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
    VALUES (v_current, p_distributor_id, v_depth)
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE
      SET depth = EXCLUDED.depth;
    v_count := v_count + 1;
    SELECT sponsor_id INTO v_current FROM distributors WHERE id = v_current;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_distributor_tree_for(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_distributor_tree_for(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_distributor_tree_for(BIGINT) TO service_role;


-- -----------------------------------------------------------------------------
-- 4. Backfill every existing distributor
-- -----------------------------------------------------------------------------
-- One-shot loop. Safe to re-run the migration; the helper is idempotent.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM distributors ORDER BY id LOOP
    PERFORM public.rebuild_distributor_tree_for(rec.id);
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 5. write_commission_ledger — extend the compressed-chain reach
-- -----------------------------------------------------------------------------
-- Plain (non-compressed) branch unchanged: pays L1..L7 by chain_depth+1.
-- Compressed branch now sees chain_depth 0..13 (= 14 levels of visibility)
-- and takes the top 7 active ancestors as L1..L7. Beyond that, levels
-- aren't paid (no rate config for L8+).

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
  v_existing              INT;
  v_count                 INT := 0;
  v_compression_enabled   BOOLEAN;
  rec                     RECORD;
  v_rate_id               BIGINT;
  v_rate_bp               INT;
  v_amount                BIGINT;
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

  SELECT COALESCE(SUM(commissionable_amount_minor), 0)::BIGINT
    INTO v_basis_minor
    FROM order_items
   WHERE order_id = p_order_id
     AND is_commissionable = TRUE;

  IF v_basis_minor = 0 THEN
    RETURN 0;
  END IF;

  v_paid_at := COALESCE(v_paid_at, NOW());
  v_compression_enabled := public.get_setting_bool(
    'commission_compression_enabled', FALSE
  );

  FOR rec IN
    WITH chain AS (
      -- Plain mode looks at depths 0..6 only (7 visible levels).
      -- Compressed mode looks at depths 0..13 (14 visible levels) so it
      -- can skip up to 7 inactives in a row and still find 7 actives.
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

    v_amount := (v_basis_minor * v_rate_bp) / 10000;
    IF v_amount = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO commission_ledger (
      distributor_id,
      source_order_id,
      source_distributor_id,
      level,
      commission_basis_minor,
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
      'basis_minor',           v_basis_minor,
      'sponsor_distributor_id', v_sponsor_distributor,
      'compression_enabled',   v_compression_enabled
    )
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_commission_ledger(BIGINT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 012
-- =============================================================================

-- >>> migrations/016_msisdn_verifications.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MSISDN SMS VERIFICATION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      016_msisdn_verifications.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 4 — back the self-service MSISDN
--                 verification flow with a one-time-code table.
--
-- Design:
--   - When a distributor submits a new payout MSISDN, the existing
--     settings action stamps it on distributors.payout_msisdn_pending
--     AND inserts a row here with a SHA-256-hashed 6-digit code and a
--     short TTL (default 15 minutes).
--   - The distributor enters the code on /account/distributor/settings/verify.
--     A match (within TTL, not used, attempts < 5) flips the distributor's
--     payout_msisdn to the pending value with verified_at = NOW.
--   - Admin can still approve manually from /admin/distributors/verifications
--     (covers the case where SMS delivery fails or the distributor lost
--     the code).
-- =============================================================================


CREATE TABLE IF NOT EXISTS msisdn_verifications (
  id                BIGSERIAL PRIMARY KEY,
  distributor_id    BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  msisdn            TEXT NOT NULL,
  code_hash         TEXT NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,
  attempts          INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active (unused, non-expired) row per distributor at a time.
-- Enforced as a partial unique index so re-submitting overrides the prior.
CREATE UNIQUE INDEX IF NOT EXISTS uq_msisdn_verifications_active
  ON msisdn_verifications(distributor_id)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_msisdn_verifications_expires_at
  ON msisdn_verifications(expires_at);

ALTER TABLE msisdn_verifications ENABLE ROW LEVEL SECURITY;

-- Distributor can read their own pending row. No writes by clients.
DROP POLICY IF EXISTS msisdn_verifications_self_read ON msisdn_verifications;
CREATE POLICY msisdn_verifications_self_read
  ON msisdn_verifications FOR SELECT
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE user_id = auth.uid()
    )
  );

-- Admin can read all (for support).
DROP POLICY IF EXISTS msisdn_verifications_admin ON msisdn_verifications;
CREATE POLICY msisdn_verifications_admin
  ON msisdn_verifications FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- =============================================================================
-- END OF MIGRATION 016
-- =============================================================================

-- >>> migrations/017_apply_clawback_deduction.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — AUTO PAYOUT ADJUSTMENT FROM CLAWBACK
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      017_apply_clawback_deduction.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 5 — when admin resolves a clawback as
--                 "deducted_from_payout", actually net the amount out
--                 of the referenced payout's net_total_minor.
--
-- Schema:         Adds clawback_resolutions.applied_at to record the
--                 moment the deduction landed on the payout. UNIQUE
--                 with deducted_from_payout_id stays from migration 011.
--
-- RPC:            apply_clawback_deduction(p_resolution_id)
--                   - Locks both rows FOR UPDATE.
--                   - Refuses if resolution isn't 'deducted_from_payout',
--                     already applied, missing the payout ref, or the
--                     payout is already in 'completed' status (money has
--                     left the building — can't deduct retroactively
--                     without a real chargeback).
--                   - Subtracts paid_amount_minor from net_total_minor,
--                     floor at 0 (won't go negative).
--                   - Stamps applied_at + audit_log.
--                   - Idempotent: a second call sees applied_at and
--                     returns FALSE.
--
-- Callers:        /admin/clawbacks resolve action calls this RPC right
--                 after stamping the resolution. If it fails the
--                 resolution remains pending and the admin can retry.
-- =============================================================================


ALTER TABLE clawback_resolutions
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

COMMENT ON COLUMN clawback_resolutions.applied_at IS
  'Set when apply_clawback_deduction() has netted the amount out of the referenced payout. NULL means the resolution is "intent only" and the operator hasn''t (or can''t) deduct yet.';


CREATE OR REPLACE FUNCTION public.apply_clawback_deduction(p_resolution_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resolution    RECORD;
  v_payout        RECORD;
  v_new_net       BIGINT;
  v_actual_deduct BIGINT;
BEGIN
  SELECT id, order_id, paid_amount_minor, resolution,
         deducted_from_payout_id, applied_at
    INTO v_resolution
    FROM clawback_resolutions
   WHERE id = p_resolution_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'clawback_resolution % not found', p_resolution_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_resolution.applied_at IS NOT NULL THEN
    RETURN FALSE;  -- already applied; idempotent no-op
  END IF;

  IF v_resolution.resolution <> 'deducted_from_payout' THEN
    RAISE EXCEPTION
      'clawback_resolution % is resolved as % — cannot deduct',
      p_resolution_id, COALESCE(v_resolution.resolution, '(unresolved)')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_resolution.deducted_from_payout_id IS NULL THEN
    RAISE EXCEPTION
      'clawback_resolution % marked as deducted_from_payout but no payout id',
      p_resolution_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT id, status, net_total_minor
    INTO v_payout
    FROM payouts
   WHERE id = v_resolution.deducted_from_payout_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout % not found', v_resolution.deducted_from_payout_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- A completed payout has already disbursed; netting out retroactively
  -- would create a phantom debt without a real reversal. Refuse.
  IF v_payout.status = 'completed' THEN
    RAISE EXCEPTION
      'payout % is already completed — cannot deduct after disbursement',
      v_payout.id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Floor at 0 — we never want a negative payout. If the clawback amount
  -- exceeds what's left in the payout, the difference is silently
  -- absorbed (it's already been disbursed in some other form; the audit
  -- row captures both the requested and actual deduction).
  v_actual_deduct := LEAST(v_resolution.paid_amount_minor::BIGINT,
                           v_payout.net_total_minor::BIGINT);
  v_new_net := v_payout.net_total_minor::BIGINT - v_actual_deduct;

  UPDATE payouts
     SET net_total_minor = v_new_net
   WHERE id = v_payout.id;

  UPDATE clawback_resolutions
     SET applied_at = NOW()
   WHERE id = p_resolution_id;

  INSERT INTO audit_log (
    action, resource_type, resource_id, after_data
  ) VALUES (
    'clawback.applied_to_payout',
    'payouts',
    v_payout.id::TEXT,
    jsonb_build_object(
      'resolution_id',          p_resolution_id,
      'source_order_id',        v_resolution.order_id,
      'requested_deduct_minor', v_resolution.paid_amount_minor,
      'actual_deduct_minor',    v_actual_deduct,
      'payout_net_before',      v_payout.net_total_minor,
      'payout_net_after',       v_new_net
    )
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_clawback_deduction(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_clawback_deduction(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_clawback_deduction(BIGINT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 017
-- =============================================================================

-- >>> migrations/018_manual_ledger_adjustments.sql <<<
-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — MANUAL LEDGER ADJUSTMENTS
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      018_manual_ledger_adjustments.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 9 — admin-driven, audited, signed
--                 commission adjustments that the payout-drafting flow
--                 includes in its gross calculation.
--
-- Why a new table?
--   commission_ledger.source_order_id is NOT NULL REFERENCES orders(id).
--   Manual adjustments are not tied to a specific order — they're ops
--   corrections (a missed bonus, a clawback the admin chooses to refund,
--   a goodwill credit, a deduction agreed with a distributor). Storing
--   them on commission_ledger would require either an FK-free sentinel
--   row or weakening the FK. A separate table keeps semantics clean,
--   leaves commission_ledger as the immutable per-order fan-out, and
--   makes auditing trivial.
--
-- Inclusion in payouts:
--   payouts/draft.ts now also reads unpaid manual_ledger_adjustments for
--   the period and includes their amount in commissions_total_minor.
--   Setting payout_id on the adjustment row claims it the same way
--   commission_ledger does.
-- =============================================================================


CREATE TABLE IF NOT EXISTS manual_ledger_adjustments (
  id                  BIGSERIAL PRIMARY KEY,
  distributor_id      BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  amount_minor        BIGINT NOT NULL,                       -- signed: positive = credit, negative = debit
  currency            CHAR(3) NOT NULL DEFAULT 'KES',
  period_year         INT NOT NULL,
  period_month        INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reason              TEXT NOT NULL CHECK (length(reason) >= 3),
  actor_id            UUID REFERENCES profiles(id),
  payout_id           BIGINT REFERENCES payouts(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mla_distributor_period
  ON manual_ledger_adjustments(distributor_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_mla_unpaid
  ON manual_ledger_adjustments(distributor_id)
  WHERE payout_id IS NULL;

ALTER TABLE manual_ledger_adjustments ENABLE ROW LEVEL SECURITY;

-- Distributors can read their own adjustments (transparency).
DROP POLICY IF EXISTS mla_self_read ON manual_ledger_adjustments;
CREATE POLICY mla_self_read
  ON manual_ledger_adjustments FOR SELECT
  USING (
    distributor_id IN (
      SELECT id FROM distributors WHERE user_id = auth.uid()
    )
  );

-- Admin can do anything. No client writes.
DROP POLICY IF EXISTS mla_admin ON manual_ledger_adjustments;
CREATE POLICY mla_admin
  ON manual_ledger_adjustments FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- =============================================================================
-- END OF MIGRATION 018
-- =============================================================================

