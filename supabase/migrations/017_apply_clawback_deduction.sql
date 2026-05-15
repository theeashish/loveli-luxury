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
