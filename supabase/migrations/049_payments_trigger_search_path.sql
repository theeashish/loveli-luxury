-- =============================================================================
-- 049_payments_trigger_search_path.sql
-- =============================================================================
-- Migration:   049_payments_trigger_search_path.sql
-- Date:        2026-06-03
-- Purpose:     Phase 0 follow-up. Pin `search_path` on the
--              `payments_touch_updated_at` trigger function created in
--              migration 047, matching the hardened pattern migration 033
--              applied to the rest of the SECURITY-relevant SQL functions.
--
-- Why:         The Supabase security advisor
--              (lint 0011_function_search_path_mutable) flagged the new
--              function as having a mutable search_path. Without a pinned
--              path, a malicious caller who can create an object in an
--              earlier-resolved schema could shadow `NOW()` or `RETURN NEW`
--              calls. The fix is to set `search_path = public, pg_temp`.
--
-- Idempotent — CREATE OR REPLACE.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.payments_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '049_payments_trigger_search_path',
  jsonb_build_object(
    'description',
    'Pinned search_path on payments_touch_updated_at trigger function (closes Supabase advisor 0011_function_search_path_mutable introduced by 047).',
    'phase', '0d'
  )
);
