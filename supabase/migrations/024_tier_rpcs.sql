-- 024_tier_rpcs.sql
--
-- Phase 2a — RPCs that operate on the partner_qualifications
-- materialized view + partner_tiers table introduced by migration 023.
--
-- This migration introduces NO new tables, NO writes to commission /
-- payout / ledger paths. The compensation engine stays on v1_rank
-- until Phase 2b explicitly flips the flag.
--
-- Idempotent.  Safe to re-run.

-- ---------------------------------------------------------------------
-- compute_partner_qualifications(p_distributor_id) — returns the latest
-- qualification row for a single distributor as a JSON object. Cheap
-- read against the materialized view. Service-role only.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_partner_qualifications(
  p_distributor_id BIGINT
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'distributor_id',              pq.distributor_id,
    'verified_revenue_90d_minor',  pq.verified_revenue_90d_minor,
    'unique_buyers_90d',           pq.unique_buyers_90d,
    'paid_orders_90d',             pq.paid_orders_90d,
    'retention_score_90d',         pq.retention_score_90d,
    'computed_at',                 pq.computed_at
  )
    FROM partner_qualifications pq
   WHERE pq.distributor_id = p_distributor_id;
$$;

GRANT EXECUTE ON FUNCTION public.compute_partner_qualifications(BIGINT)
  TO service_role;

-- ---------------------------------------------------------------------
-- refresh_partner_qualifications() — REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- Called by the monthly close cron + the admin "Recompute now" button on
-- /admin/comp/partner-qualifications. Returns the row count post-refresh
-- so the caller can show a useful confirmation.
--
-- CONCURRENTLY is safe here because idx_partner_qualifications_distributor
-- is UNIQUE (created in migration 023). Non-blocking for readers.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_partner_qualifications()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_count BIGINT;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY partner_qualifications;
  SELECT COUNT(*) INTO v_row_count FROM partner_qualifications;
  RETURN v_row_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_partner_qualifications()
  TO service_role;

-- ---------------------------------------------------------------------
-- Audit log entry
-- ---------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '024_tier_rpcs',
  jsonb_build_object(
    'description',
    'Added compute_partner_qualifications + refresh_partner_qualifications RPCs. Pure-read; no writes to commission/payout/ledger paths.'
  )
);

-- DOWN (manual):
--   DROP FUNCTION IF EXISTS public.compute_partner_qualifications(BIGINT);
--   DROP FUNCTION IF EXISTS public.refresh_partner_qualifications();
