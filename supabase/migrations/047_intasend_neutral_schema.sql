-- =============================================================================
-- 047_intasend_neutral_schema.sql
-- =============================================================================
-- Migration:   047_intasend_neutral_schema.sql
-- Date:        2026-06-03
-- Purpose:     Phase 0 of the PayHero → IntaSend cutover. Creates the
--              provider-neutral schema the IntaSend integration will use,
--              extends `payouts` to match the IntaSend dispatch model, and
--              drops the `'payhero'` defaults so new rows don't inherit a
--              dead provider name.
--
-- Reconciled against the existing PayHero-era schema (migration 019):
--
--   • `payments` (NEW)
--     One row per IntaSend collection — the per-invoice state record
--     that replaces `orders.payhero_*` for new orders. Historical
--     rows are backfilled by migration 048. `payment_attempts` (also
--     introduced in 019) is RETAINED — it is the per-API-call audit
--     log and is complementary to `payments`, not redundant with it.
--
--   • `payouts` (EXTENDED, additive only)
--     The existing `payouts` table is the monthly distributor grant
--     (one row per distributor per period — see migration 001's
--     UNIQUE(distributor_id, period_year, period_month)). The IntaSend
--     dispatch model adds per-transaction metadata: account, bank_code,
--     tracking_id, requires_approval, approved_by, raw_payload,
--     recipient_type (member|vendor), payout_type (commission|
--     vendor_settlement). The historical `payhero_*` columns stay
--     NULLABLE so admin tooling that reads them keeps working until
--     they are formally retired in a later cleanup migration.
--
--   • `webhook_deliveries` (RENAMED conceptually; column added)
--     The IntaSend spec calls this `webhook_events`. The functional
--     contract is identical (UNIQUE(provider, event_id) dedup, JSONB
--     body, signature flag, processed_at). To minimise blast radius we
--     keep the existing table name and the existing column names; the
--     spec's `signature_valid` = `signature_ok`, the spec's `payload`
--     = `body`. The only structural change is the addition of
--     `invoice_or_tracking_id` so the IntaSend webhook handler can
--     index events by invoice OR tracking id efficiently.
--
--   • Defaults
--     `orders.payment_provider` and `payouts.provider` had a
--     `DEFAULT 'payhero'` set in migration 019. Defaults dropped here;
--     new rows must set the provider explicitly. Existing populated
--     rows keep their 'payhero' value (audit history preserved).
--
-- Currency convention (carried forward):
--   All money is BIGINT in minor units. The new `payments.amount_cents`
--   column follows the IntaSend spec's naming; for KES (1 KES = 100
--   cents) "cents" and "minor units" are synonymous. Other modules in
--   this codebase use the `_minor` suffix; the new column uses the
--   spec's name so future reviewers reading the IntaSend code see the
--   field as written.
--
-- RLS:
--   `payments` follows the established posture: members read their own
--   rows (matched on user_id), admins/superadmins do everything.
--
-- Idempotent — safe to re-run; uses IF NOT EXISTS on every alter.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- payments (NEW)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payments (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  order_id      BIGINT       REFERENCES orders(id)   ON DELETE CASCADE,
  invoice_id    TEXT         NOT NULL,
  amount_cents  BIGINT       NOT NULL CHECK (amount_cents >= 0),
  currency      CHAR(3)      NOT NULL DEFAULT 'KES',
  channel       TEXT         NOT NULL,
  status        TEXT         NOT NULL CHECK (status IN ('pending','processing','complete','failed')),
  raw_payload   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One invoice_id per provider transaction. The IntaSend invoice id is
-- globally unique; this is also the dedup key the webhook handler uses
-- before applying any state mutation.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_payments_invoice_id
  ON payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON payments (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_created
  ON payments (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status_created
  ON payments (status, created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_self_read ON payments;
CREATE POLICY payments_self_read ON payments
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS payments_admin_all ON payments;
CREATE POLICY payments_admin_all ON payments
  FOR ALL
  USING (has_role('admin') OR has_role('superadmin'));

-- updated_at trigger — mirrors the convention used on orders / profiles.
CREATE OR REPLACE FUNCTION public.payments_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_touch_updated_at ON payments;
CREATE TRIGGER trg_payments_touch_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_touch_updated_at();

-- -----------------------------------------------------------------------------
-- payouts (EXTENDED — additive)
-- -----------------------------------------------------------------------------

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS recipient_type      TEXT NOT NULL DEFAULT 'member'
    CHECK (recipient_type IN ('member','vendor')),
  ADD COLUMN IF NOT EXISTS payout_type         TEXT NOT NULL DEFAULT 'commission'
    CHECK (payout_type IN ('commission','vendor_settlement')),
  ADD COLUMN IF NOT EXISTS account             TEXT,
  ADD COLUMN IF NOT EXISTS bank_code           TEXT,
  ADD COLUMN IF NOT EXISTS tracking_id         TEXT,
  ADD COLUMN IF NOT EXISTS requires_approval   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_by         UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS raw_payload         JSONB NOT NULL DEFAULT '{}'::jsonb;

-- tracking_id is the IntaSend batch id; multiple payouts can share one
-- tracking_id (batch dispatch). Index, not unique.
CREATE INDEX IF NOT EXISTS idx_payouts_tracking_id
  ON payouts (tracking_id)
  WHERE tracking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payouts_requires_approval
  ON payouts (requires_approval, created_at DESC)
  WHERE requires_approval = TRUE AND approved_by IS NULL;

-- Backfill recipient_type for historical PayHero/Flutterwave-era payouts:
-- every existing row is a distributor (member) commission, since those
-- were the only payouts the platform supported pre-IntaSend.
UPDATE payouts
   SET recipient_type = 'member',
       payout_type    = 'commission'
 WHERE recipient_type IS NULL
    OR payout_type    IS NULL;

-- -----------------------------------------------------------------------------
-- webhook_deliveries: extend with invoice_or_tracking_id
--
-- The IntaSend spec names this table `webhook_events`. The existing table
-- is functionally identical (UNIQUE(provider, event_id) dedup; JSONB body;
-- signature flag). Keeping the existing name avoids renaming the
-- record_webhook_delivery / mark_webhook_processed RPCs and every caller.
-- Equivalent columns:
--   spec `signature_valid`  ⇔  existing `signature_ok`
--   spec `payload`          ⇔  existing `body`
--   spec `processed bool`   ⇔  existing `processed_at TIMESTAMPTZ` (richer)
-- -----------------------------------------------------------------------------

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS invoice_or_tracking_id TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_invoice_or_tracking
  ON webhook_deliveries (invoice_or_tracking_id)
  WHERE invoice_or_tracking_id IS NOT NULL;

COMMENT ON TABLE webhook_deliveries IS
  'Provider webhook dedup + payload archive. The IntaSend spec refers to this table as `webhook_events`; the contract is identical.';

COMMENT ON COLUMN webhook_deliveries.signature_ok IS
  'Boolean — IntaSend spec calls this `signature_valid`.';

COMMENT ON COLUMN webhook_deliveries.body IS
  'Raw webhook payload — IntaSend spec calls this `payload`.';

-- -----------------------------------------------------------------------------
-- Drop the dead 'payhero' defaults
-- -----------------------------------------------------------------------------

ALTER TABLE orders   ALTER COLUMN payment_provider DROP DEFAULT;
ALTER TABLE payouts  ALTER COLUMN provider         DROP DEFAULT;

-- -----------------------------------------------------------------------------
-- Audit log entry for the migration
-- -----------------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '047_intasend_neutral_schema',
  jsonb_build_object(
    'description',
    'Phase 0 PayHero → IntaSend cutover. Created provider-neutral payments table; extended payouts with IntaSend dispatch fields (recipient_type, payout_type, account, bank_code, tracking_id, requires_approval, approved_by, raw_payload); added webhook_deliveries.invoice_or_tracking_id; dropped DEFAULT ''payhero'' from orders.payment_provider and payouts.provider. Historical payhero_* columns retained (nullable) on orders and payouts. Migration 048 backfills payments from orders.payhero_*.',
    'phase', '0b'
  )
);

NOTIFY pgrst, 'reload schema';
