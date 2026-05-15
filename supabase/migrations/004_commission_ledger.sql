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
