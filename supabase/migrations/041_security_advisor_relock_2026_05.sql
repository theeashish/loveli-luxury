-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — SECURITY ADVISOR RE-LOCK
-- =============================================================================
-- Migration:   041_security_advisor_relock_2026_05.sql
-- Date:        30 May 2026
-- Purpose:     Close two live Supabase security-advisor findings that are safe
--              to fix in code (verified against the real ACLs + app code).
--
-- Context: the 2026-05-30 advisor sweep (get_advisors) flagged, among others:
--   * public.is_distributor_meeting_pv is EXECUTE-able by anon/authenticated
--     even though migration 033 revoked it. The live ACL shows `=X` (PUBLIC) —
--     the function was recreated after 033 (E2 / migration 032) and picked the
--     default PUBLIC EXECUTE grant back up. It is an INTERNAL engine helper
--     (called only inside is_distributor_maintained / write_commission_ledger,
--     which run as service_role) — anon/authenticated must not call it directly.
--   * Public bucket `catalog` has a broad SELECT policy on storage.objects
--     (catalog_storage_read) that lets any client LIST every file. Public
--     buckets serve object URLs WITHOUT this policy; the app never calls
--     storage .list() (only .upload()/.remove() in catalog/mutations.ts), so
--     listing is pure attack surface (image-filename enumeration).
--
-- Deliberately NOT changed here (intentional per masterplan Appendix J):
--   * has_role(), default_sponsor_code() stay anon/authenticated-executable —
--     has_role backs RLS policies and default_sponsor_code is needed by the
--     anonymous signup/attribution path. Revoking them would break RLS.
--   * citext-in-public and Auth leaked-password protection are owner-side
--     (extension move = data-type churn; Auth toggle = dashboard setting).
-- =============================================================================

-- ----------------------------------------------------------------------
-- 1. Re-lock the engine helper to service_role only (idempotent).
-- ----------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_distributor_meeting_pv(BIGINT, INT, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_distributor_meeting_pv(BIGINT, INT, INT)
  TO service_role;

-- ----------------------------------------------------------------------
-- 2. Remove the catalog bucket's broad object-listing policy.
-- ----------------------------------------------------------------------
-- Public URL reads (/storage/v1/object/public/catalog/...) do NOT consult this
-- policy, so dropping it does not affect the storefront. Admin upload/delete are
-- governed by their own INSERT/UPDATE/DELETE policies (migration 002) and are
-- unaffected. Wrapped so a fresh DB without the storage table still applies.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage' AND tablename = 'objects'
       AND policyname = 'catalog_storage_read'
  ) THEN
    DROP POLICY catalog_storage_read ON storage.objects;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- storage.objects absent (e.g. bare test Postgres) — nothing to do.
    NULL;
END $$;

-- ----------------------------------------------------------------------
-- 3. Audit trail.
-- ----------------------------------------------------------------------
INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '041_security_advisor_relock_2026_05',
  jsonb_build_object(
    'relocked', 'is_distributor_meeting_pv -> service_role only',
    'storage', 'dropped catalog_storage_read listing policy',
    'kept_by_design', 'has_role, default_sponsor_code (RLS + signup)'
  )
);

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION 041
-- =============================================================================
