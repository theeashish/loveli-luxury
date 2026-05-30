-- 034_remove_v2_4tier_scaffolding.sql
--
-- Owner confirmed 2026-05-28: the v2 4-tier comp engine (Concierge / Brand
-- Associate / Regional Curator / Prestige) was shelved on 2026-05-22 in
-- favour of the 5-rank v1 model the client uses (config_ranks: Ambassador
-- through Crown President). The scaffolding has been dormant since then.
-- Removing it so the next engineer doesn't see two engines and wonder which
-- one matters.
--
-- What this drops:
--   - partner_tiers table (was 6 rows of Concierge/Brand Associate/Regional
--     Curator/Prestige + 2 audit rows).
--   - partner_qualifications materialized view + the two RPCs that read it.
--   - distributors.current_tier_id column (was set on 3 rows — pre-decision
--     leftover; the 5-rank model uses current_rank_id instead).
--   - commission_ledger.{compensation_engine,tier_at_time_id} columns
--     (added in 027 for the v2 dry-run audit; never went into production
--     beyond a handful of preview rows).
--   - commission_ledger_v2_preview table (2 rows from the dry-run on order
--     11 + 20).
--
-- What stays untouched:
--   - config_ranks (the 5-rank v1 engine — Ambassador through Crown President).
--   - distributors.current_rank_id.
--   - commission_ledger itself (the production v1 ledger).
--   - src/lib/partners/tiers.ts (already rewritten to map the 5 ranks).
--
-- Applied via MCP on 2026-05-28.

DROP FUNCTION IF EXISTS public.compute_partner_qualifications(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_partner_qualifications() CASCADE;

DROP MATERIALIZED VIEW IF EXISTS public.partner_qualifications CASCADE;

DROP TABLE IF EXISTS public.partner_tiers CASCADE;

ALTER TABLE public.distributors DROP COLUMN IF EXISTS current_tier_id;

ALTER TABLE public.commission_ledger
  DROP COLUMN IF EXISTS compensation_engine,
  DROP COLUMN IF EXISTS tier_at_time_id;

DROP TABLE IF EXISTS public.commission_ledger_v2_preview CASCADE;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '034_remove_v2_4tier_scaffolding',
  jsonb_build_object(
    'description',
    'Owner-confirmed removal of the dormant v2 4-tier comp scaffolding (partner_tiers, partner_qualifications matview, compute/refresh RPCs, distributors.current_tier_id, commission_ledger.compensation_engine + tier_at_time_id, commission_ledger_v2_preview). The 5-rank v1 engine (config_ranks) is unaffected.'
  )
);

NOTIFY pgrst, 'reload schema';
