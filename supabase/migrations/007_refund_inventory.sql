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
