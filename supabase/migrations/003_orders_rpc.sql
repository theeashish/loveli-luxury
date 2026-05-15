-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — ORDERS RPC MIGRATION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      003_orders_rpc.sql
-- Author:         Abala / NexDocs
-- Date:           7 May 2026
-- Purpose:        Phase 3 checkout primitives.
--                   1. order_number sequence + generate_order_number() helper
--                   2. mark_order_paid() — atomic status flip + inventory decrement
--                      + bundle expansion, idempotent against webhook retries
-- Concurrency:    The function takes a row lock on the order and relies on the
--                 product_variants.inventory_qty CHECK (>= 0) constraint to roll
--                 back on oversell. No floats, no pre-checks that race.
-- Idempotency:    If the order is not in 'pending' status the function exits as
--                 a no-op and returns FALSE so the caller can distinguish a
--                 fresh transition from a duplicate webhook delivery.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Order number generator
-- -----------------------------------------------------------------------------
-- Format: LL-YYYY-NNNNNN where YYYY is the year at allocation time and NNNNNN
-- is a zero-padded global sequence. We don't reset on year boundary; the
-- sequence is the uniqueness guarantee, the year is cosmetic.

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  v_seq := nextval('order_number_seq');
  RETURN 'LL-' || to_char(NOW(), 'YYYY') || '-' || lpad(v_seq::TEXT, 6, '0');
END;
$$;


-- -----------------------------------------------------------------------------
-- mark_order_paid
-- -----------------------------------------------------------------------------
-- Called from the Flutterwave webhook AND the redirect-return verify path.
-- Both can fire; only the first transition wins. Subsequent calls return FALSE.
--
-- Inputs:
--   p_order_id      BIGINT       internal orders.id
--   p_provider_ref  TEXT         Flutterwave transaction id (numeric, as text)
--   p_paid_at       TIMESTAMPTZ  charge completion time from FW (defaults NOW)
--
-- Returns:
--   TRUE  — this call performed the transition (caller should fire any
--           downstream side effects: revalidate, email, etc.)
--   FALSE — order was already in a non-pending state (idempotent no-op)
--
-- Raises:
--   On inventory underflow the inner UPDATE violates the variants CHECK
--   constraint and the whole function rolls back. The caller then sees the
--   order still in 'pending' state and can decide to refund.

CREATE OR REPLACE FUNCTION public.mark_order_paid(
  p_order_id      BIGINT,
  p_provider_ref  TEXT,
  p_paid_at       TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status   order_status;
  v_user_id  UUID;
BEGIN
  -- Take a row lock so concurrent callers serialise on the same order
  SELECT status, user_id
    INTO v_status, v_user_id
    FROM orders
   WHERE id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotency guard. Anything other than 'pending' means another caller
  -- already handled this transition (or it failed/cancelled). No-op.
  IF v_status <> 'pending' THEN
    RETURN FALSE;
  END IF;

  -- Decrement inventory for direct variant lines.
  -- The CHECK (inventory_qty >= 0) on product_variants will trip on oversell
  -- and roll back the entire transaction.
  UPDATE product_variants pv
     SET inventory_qty = pv.inventory_qty - oi.quantity
    FROM order_items oi
   WHERE oi.order_id = p_order_id
     AND oi.variant_id = pv.id;

  -- Decrement inventory for bundle lines by expanding bundle_items.
  -- Each order_items.bundle_id row represents oi.quantity bundles, each of
  -- which contains bundle_items.quantity of a given variant.
  UPDATE product_variants pv
     SET inventory_qty = pv.inventory_qty - delta.total_qty
    FROM (
      SELECT bi.variant_id, SUM(oi.quantity * bi.quantity)::INT AS total_qty
        FROM order_items oi
        JOIN bundle_items bi ON bi.bundle_id = oi.bundle_id
       WHERE oi.order_id = p_order_id
         AND oi.bundle_id IS NOT NULL
       GROUP BY bi.variant_id
    ) delta
   WHERE delta.variant_id = pv.id;

  -- Flip the order to paid
  UPDATE orders
     SET status               = 'paid',
         paid_at              = p_paid_at,
         payment_provider     = COALESCE(payment_provider, 'flutterwave'),
         payment_provider_ref = p_provider_ref,
         updated_at           = NOW()
   WHERE id = p_order_id;

  -- Audit log entry. actor_id is null because this runs from a webhook,
  -- not on behalf of an authenticated user.
  INSERT INTO audit_log (actor_id, action, resource_type, resource_id, after_data)
  VALUES (
    NULL,
    'order.mark_paid',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'order_id',             p_order_id,
      'payment_provider_ref', p_provider_ref,
      'paid_at',              p_paid_at,
      'user_id',              v_user_id
    )
  );

  RETURN TRUE;
END;
$$;

-- Lock the function down. Only the service role (and superuser) call this;
-- never expose to anon or authenticated.
REVOKE ALL ON FUNCTION public.mark_order_paid(BIGINT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_order_paid(BIGINT, TEXT, TIMESTAMPTZ) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(BIGINT, TEXT, TIMESTAMPTZ) TO service_role;

-- generate_order_number is also server-only (called from the checkout init
-- route via the service-role client). Keep the surface minimal.
REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO service_role;

-- =============================================================================
-- END OF MIGRATION 003
-- =============================================================================
