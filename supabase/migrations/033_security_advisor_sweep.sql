-- 033_security_advisor_sweep.sql
--
-- Bundles a set of focused fixes for the Supabase security advisor findings
-- (snapshot 2026-05-28). What this DOES address:
--   1. distributors RLS infinite recursion (active bug — Postgres logs show
--      it firing on real reads).
--   2. payment_audit_logs has RLS enabled with no policy → add admin-only.
--   3. function_search_path_mutable warnings on 7 legacy helpers → pin
--      search_path to public,pg_temp on each.
--   4. audit_log INSERT policy was WITH CHECK true → tighten to
--      "actor_id is null OR matches auth.uid()" so service_role and
--      SECURITY DEFINER paths still pass but client impersonation is blocked.
--   5. Engine RPCs that authenticated/anon don't need to call → REVOKE
--      EXECUTE so they're service_role-only. has_role and default_sponsor_code
--      stay accessible (RLS helpers + signup flow respectively).
--
-- What this does NOT address (owner-side action, see owner guide):
--   - citext extension in public schema → schema move, data-type churn.
--   - auth_leaked_password_protection → Supabase Auth dashboard setting.
--   - catalog bucket listing → storage policy tightening (defer until we
--     can confirm no admin code relies on listing).
--
-- Applied via MCP on 2026-05-28.

-- ----------------------------------------------------------------------
-- 1. distributors RLS recursion fix
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_distributor_id()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT id
    FROM public.distributors
   WHERE user_id = auth.uid()
   LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.current_distributor_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_distributor_id() TO authenticated, service_role;

DROP POLICY IF EXISTS distributors_downline_read ON public.distributors;
CREATE POLICY distributors_downline_read ON public.distributors
  FOR SELECT USING (
    id IN (
      SELECT dt.descendant_id
        FROM public.distributor_tree dt
       WHERE dt.ancestor_id = public.current_distributor_id()
    )
  );

-- ----------------------------------------------------------------------
-- 2. payment_audit_logs admin-only RLS
-- ----------------------------------------------------------------------

-- This table was hand-created on prod and never had its own migration, so a
-- from-scratch replay (disaster recovery, CI, integration tests) reached this
-- point without it and failed. Create it idempotently — columns match the live
-- schema (src/types/database.ts) — so replay is clean; on the live DB, where
-- the table already exists, this is a no-op. (Migration-replay hygiene, 040 era.)
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code  TEXT,
  event_type  TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_audit_logs_admin ON public.payment_audit_logs;
CREATE POLICY payment_audit_logs_admin ON public.payment_audit_logs
  FOR ALL USING (
    public.has_role('admin'::user_role) OR public.has_role('superadmin'::user_role)
  );

-- ----------------------------------------------------------------------
-- 3. Pin search_path on legacy helpers
-- ----------------------------------------------------------------------

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.has_role(target_role user_role)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_sponsor_code()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_order_number()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_setting_bool(p_key text, p_default boolean)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.rebuild_distributor_tree_for(p_distributor_id bigint)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.add_distributor_to_tree(p_new_distributor_id bigint, p_parent_distributor_id bigint)
  SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------
-- 4. audit_log INSERT — block impersonation
-- ----------------------------------------------------------------------

DROP POLICY IF EXISTS audit_insert_system ON public.audit_log;
CREATE POLICY audit_insert_self ON public.audit_log
  FOR INSERT WITH CHECK (
    actor_id IS NULL OR actor_id = auth.uid()
  );

-- ----------------------------------------------------------------------
-- 5. Engine RPCs → service_role only
-- ----------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION
  public.is_distributor_meeting_pv(bigint, integer, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.is_distributor_maintained(bigint, integer, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.is_distributor_qualified_for_rank(bigint, bigint, integer, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.count_qualifying_streak(bigint, bigint, integer, integer, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.compute_partner_qualifications(bigint)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.refresh_partner_qualifications()
  FROM anon, authenticated;

-- ----------------------------------------------------------------------
-- 6. Audit log entry
-- ----------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '033_security_advisor_sweep',
  jsonb_build_object(
    'description',
    'Security advisor sweep: fixed distributors RLS infinite recursion, added payment_audit_logs admin RLS, pinned search_path on 7 legacy helpers, tightened audit_log INSERT, revoked engine-RPC EXECUTE from anon/authenticated.'
  )
);

NOTIFY pgrst, 'reload schema';
