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
