-- 022_webhook_deliveries_event_type.sql
--
-- Schema drift hotfix for webhook_deliveries. Migration 019 in this
-- repo defines several columns on webhook_deliveries (event_type,
-- error) that the live production DB is missing — it was created from
-- an earlier draft of 019 before those columns existed.
--
-- Effect of the drift:
--   - record_webhook_delivery() RPC inserts into event_type → 42703
--   - mark_webhook_processed()  RPC updates error           → 42703
--   - PayHero webhook handler returns 500 → orders never flip to paid
--
-- Symptom seen during the first post-deploy STK test on 2026-05-18:
-- customer paid Ksh 1 via M-Pesa, money landed in Paybill 174379, but
-- the order stayed pending forever because our handler couldn't store
-- the delivery row.
--
-- Additive. Idempotent. Safe to re-run. Existing rows get NULL in the
-- new columns — harmless.

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS error      TEXT;

-- Migration 019 also expected these indexes — recreate idempotently in
-- case the original apply only created the table and not the indexes.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_received
  ON webhook_deliveries (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_provider_received
  ON webhook_deliveries (provider, received_at DESC);

-- Same for the RLS policy. ENABLE is idempotent; the DROP-then-CREATE
-- pattern from 019 itself remains valid.
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_deliveries_admin ON webhook_deliveries;
CREATE POLICY webhook_deliveries_admin ON webhook_deliveries
  FOR ALL USING (has_role('admin') OR has_role('superadmin'));

-- Audit log entry
INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '022_webhook_deliveries_event_type',
  jsonb_build_object(
    'description',
    'Backfilled webhook_deliveries columns event_type + error to match migration 019 spec. Reasserted indexes and RLS. Unblocks PayHero webhook ingestion which had been failing with 42703.'
  )
);

-- DOWN (manual):
--   ALTER TABLE webhook_deliveries DROP COLUMN IF EXISTS event_type;
--   ALTER TABLE webhook_deliveries DROP COLUMN IF EXISTS error;
-- Both columns are nullable, so existing rows have NULL — harmless.
