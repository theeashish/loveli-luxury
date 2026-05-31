-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — RECONCILE STRANDED DISTRIBUTORS
-- =============================================================================
-- Migration:   044_reconcile_stranded_distributors.sql
-- Date:        30 May 2026
-- Purpose:     Fix the live consequences of a latent bug in the soft-delete
--              flow (/admin/system/users → deactivateUser action).
--
-- The bug:     The deactivate action revoked roles, banned the auth user, and
--              anonymised the email — but never flipped distributors.is_active.
--              Result: the deactivated user's distributor row stays ACTIVE,
--              meaning:
--                a) the commission engine keeps including them in the upline
--                   chain (write_commission_ledger filters d.is_active = TRUE),
--                b) the still-stored payout_msisdn could receive a B2C transfer
--                   when payouts run against that row.
--              For a money system the deactivation MUST sever both identities.
--
-- Code fix:    Already shipped — src/app/(admin)/admin/system/users/actions.ts
--              now flips distributors.is_active = FALSE inside deactivateUser
--              and audits the previous state for reversal.
--
-- This migration: backfills the rows the buggy version left behind. Idempotent
--              (only touches still-active distributors whose owning auth.user
--              has the deleted-...@deleted.local email shape). Audit row carries
--              full before-state so an engineer can reverse a row if a soft-
--              deleted user is ever reinstated.
-- =============================================================================

DO $$
DECLARE
  v_strand RECORD;
  v_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_msisdns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_strand IN
    SELECT d.id, d.sponsor_code, d.payout_msisdn
    FROM public.distributors d
    JOIN auth.users u ON u.id = d.user_id
    WHERE d.is_active = TRUE
      AND u.email LIKE 'deleted-%@deleted.local'
  LOOP
    v_ids := v_ids || v_strand.id;
    v_codes := v_codes || v_strand.sponsor_code;
    v_msisdns := v_msisdns || COALESCE(v_strand.payout_msisdn, '');
  END LOOP;

  IF array_length(v_ids, 1) IS NULL THEN
    RAISE NOTICE 'No stranded distributors. No-op.';
    RETURN;
  END IF;

  UPDATE public.distributors
     SET is_active = FALSE,
         updated_at = NOW()
   WHERE id = ANY(v_ids);

  INSERT INTO public.audit_log (actor_id, action, resource_type, resource_id, after_data)
  VALUES (
    NULL,
    'distributor.deactivated_by_reconcile',
    'distributors',
    '044_reconcile_stranded_distributors',
    jsonb_build_object(
      'reason', 'Owning auth user was soft-deleted (deleted-*@deleted.local), but distributor stayed active. See actions.ts fix shipped same day.',
      'distributor_ids', to_jsonb(v_ids),
      'sponsor_codes',   to_jsonb(v_codes),
      'payout_msisdns',  to_jsonb(v_msisdns),
      'count',           array_length(v_ids, 1)
    )
  );
END $$;

-- =============================================================================
-- END OF MIGRATION 044
-- =============================================================================
