-- 020_processing_fee.sql
--
-- Adds a dedicated column for the PayHero (or future provider) per-order
-- processing fee. The fee is computed at checkout-init time, added to
-- `total_minor`, and persisted here so the breakdown is recoverable for
-- receipts, reporting and reconciliation.
--
-- Additive only. Idempotent. Existing rows default to 0 — they were
-- placed before fee passthrough existed (business absorbed the fee).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS processing_fee_minor BIGINT NOT NULL DEFAULT 0
    CHECK (processing_fee_minor >= 0);

-- Audit log entry
INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '020_processing_fee',
  jsonb_build_object(
    'description',
    'Added orders.processing_fee_minor for per-order payment-provider fee passthrough.'
  )
);
