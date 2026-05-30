-- 027_engine_v2_staging.sql
-- Phase 2b — compensation engine v2 staging. Additive. Idempotent.
-- Requires migration 023 (partner_tiers). NO BEHAVIOUR CHANGE until the
-- COMPENSATION_ENGINE env flag moves off 'v1_rank' after a signed-off dry-run.
--
-- Renumbered from 025 → 027 to avoid colliding with 025_wishlist.sql.
-- Applied to production 2026-05-21 via the Supabase connector.

ALTER TABLE commission_ledger
  ADD COLUMN IF NOT EXISTS compensation_engine TEXT NOT NULL DEFAULT 'v1_rank';

ALTER TABLE commission_ledger
  ADD COLUMN IF NOT EXISTS tier_at_time_id BIGINT REFERENCES partner_tiers(id);

CREATE TABLE IF NOT EXISTS commission_ledger_v2_preview (
  id                     BIGSERIAL PRIMARY KEY,
  source_order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  distributor_id         BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  source_distributor_id  BIGINT REFERENCES distributors(id),
  level                  INT NOT NULL,
  kind                   TEXT NOT NULL CHECK (kind IN ('direct', 'override')),
  commission_basis_minor BIGINT NOT NULL,
  rate_basis_points      INT NOT NULL,
  amount_minor           BIGINT NOT NULL,
  tier_at_time_id        BIGINT REFERENCES partner_tiers(id),
  tier_position          INT,
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clv2_preview_order
  ON commission_ledger_v2_preview (source_order_id);

ALTER TABLE commission_ledger_v2_preview ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clv2_preview_admin ON commission_ledger_v2_preview;
CREATE POLICY clv2_preview_admin ON commission_ledger_v2_preview
  FOR ALL USING (has_role('admin')) WITH CHECK (has_role('admin'));

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '027_engine_v2_staging',
  jsonb_build_object(
    'description',
    'Phase 2b staging: commission_ledger.compensation_engine + tier_at_time_id columns; commission_ledger_v2_preview table (admin-only RLS). No behaviour change until COMPENSATION_ENGINE flips off v1_rank after a signed-off dry-run.'
  )
);

-- DOWN (manual):
--   DROP TABLE IF EXISTS commission_ledger_v2_preview;
--   ALTER TABLE commission_ledger DROP COLUMN IF EXISTS tier_at_time_id;
--   ALTER TABLE commission_ledger DROP COLUMN IF EXISTS compensation_engine;
