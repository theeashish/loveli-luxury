-- 021_default_sponsor_rpc.sql
--
-- Adds public.default_sponsor_code() — returns the founding distributor's
-- sponsor_code. Called from middleware to attribute orphan / SEO traffic
-- to the house so every order has a sponsor.
--
-- SECURITY DEFINER so the anon client can call it without violating the
-- distributors_self_read RLS policy. We never return identifying data
-- (no id, no user_id) — only the sponsor_code that's already meant to be
-- public (it appears in /r/<code> referral URLs).
--
-- Returns NULL if no founder has been bootstrapped yet. Middleware
-- treats NULL as "skip the attribution" (transitional state).
--
-- Additive only. Idempotent via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.default_sponsor_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sponsor_code
    FROM distributors
   WHERE sponsor_id IS NULL
     AND is_active = TRUE
   ORDER BY joined_at ASC
   LIMIT 1
$$;

-- Allow anon + authenticated to call it (everyone needs the default sponsor
-- attribution, including signed-out browsers).
GRANT EXECUTE ON FUNCTION public.default_sponsor_code() TO anon, authenticated;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '021_default_sponsor_rpc',
  jsonb_build_object(
    'description',
    'Added public.default_sponsor_code() RPC for SEO / orphan attribution.'
  )
);
