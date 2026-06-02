-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — DROP STALE FLUTTERWAVE COLUMNS
-- =============================================================================
-- Migration:   045_drop_flutterwave_columns.sql
-- Date:        2 June 2026
-- Purpose:     Retire the last live trace of the pre-PayHero Flutterwave era.
--
-- Context:     The platform migrated from Flutterwave to PayHero in early
--              May 2026. Migration 019 (`payment_provider`) added the new
--              `payouts.payhero_transfer_reference` column and the
--              `provider` discriminator, BUT did not drop the old
--              `payouts.flutterwave_transfer_id` column — it left it for
--              a separate cleanup pass. Today is that pass.
--
-- Pre-flight (verified 2026-06-02 via the Supabase MCP):
--   - payouts.flutterwave_transfer_id is TEXT NULL — zero rows non-null.
--   - payouts.payhero_transfer_reference is TEXT NULL — the live target.
--   - payouts.provider is TEXT NOT NULL — current values 'payhero' only.
--
-- Therefore dropping the column loses no data and breaks no FK. Code
-- touchpoints (admin payouts list page, admin payouts detail page) are
-- updated to read `payhero_transfer_reference` in the same commit so the
-- DB drop and the code change land together — no transient broken view.
--
-- IF this migration ever fails because a row exists with a non-null
-- flutterwave_transfer_id, STOP and investigate — that row would represent
-- a real historical payout, and dropping the column would lose audit data
-- that AML/KYC retention requires. The pre-check is in this migration's
-- DO block.
-- =============================================================================

DO $$
DECLARE
  v_rows_with_data INT;
BEGIN
  SELECT COUNT(*) INTO v_rows_with_data
  FROM public.payouts
  WHERE flutterwave_transfer_id IS NOT NULL;

  IF v_rows_with_data > 0 THEN
    RAISE EXCEPTION 'REFUSING to drop payouts.flutterwave_transfer_id: % rows have non-null values that would be lost. Investigate before re-running this migration.', v_rows_with_data;
  END IF;
END $$;

ALTER TABLE public.payouts
  DROP COLUMN IF EXISTS flutterwave_transfer_id;

INSERT INTO public.audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '045_drop_flutterwave_columns',
  jsonb_build_object(
    'dropped', 'payouts.flutterwave_transfer_id (TEXT, NULL, zero non-null rows pre-flight)',
    'replacement', 'payouts.payhero_transfer_reference (live since migration 019)',
    'reason', 'Final Flutterwave→PayHero cleanup; column was dormant since 2026-05-07.'
  )
);

NOTIFY pgrst, 'reload schema';
