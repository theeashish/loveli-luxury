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
