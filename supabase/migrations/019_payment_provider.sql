-- 019_payment_provider.sql
--
-- Adds PayHero alongside Flutterwave. Additive only — no destructive
-- changes. The two providers coexist; orders/payouts carry a `provider`
-- column and the relevant provider-specific reference columns. After 7
-- days of PayHero stability the Flutterwave columns can be dropped in a
-- follow-up migration; for now they stay so in-flight FW transactions
-- continue to settle.
--
-- Idempotent — safe to re-run.

-- ----------------------------------------------------------------------
-- orders: extend with PayHero columns. `payment_provider` already
-- existed (nullable TEXT) from 001. Tighten the default to 'payhero'
-- for new rows; existing rows keep whatever they had.
-- ----------------------------------------------------------------------

ALTER TABLE orders
  ALTER COLUMN payment_provider SET DEFAULT 'payhero';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payhero_checkout_reference TEXT,
  ADD COLUMN IF NOT EXISTS payhero_external_reference TEXT,
  ADD COLUMN IF NOT EXISTS payhero_mpesa_receipt      TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_payhero_checkout_ref
  ON orders (payhero_checkout_reference)
  WHERE payhero_checkout_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payhero_external_ref
  ON orders (payhero_external_reference)
  WHERE payhero_external_reference IS NOT NULL;

-- ----------------------------------------------------------------------
-- payouts: extend for B2C via PayHero. flutterwave_transfer_id stays.
-- ----------------------------------------------------------------------

ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS provider                    TEXT NOT NULL DEFAULT 'payhero',
  ADD COLUMN IF NOT EXISTS payhero_transfer_reference  TEXT,
  ADD COLUMN IF NOT EXISTS payhero_mpesa_receipt       TEXT;

CREATE INDEX IF NOT EXISTS idx_payouts_payhero_transfer_ref
  ON payouts (payhero_transfer_reference)
  WHERE payhero_transfer_reference IS NOT NULL;

-- Backfill existing payouts' provider — they're Flutterwave by definition
-- since PayHero didn't exist before this migration. Without this they'd
-- inherit the new default and be mis-attributed.
UPDATE payouts
   SET provider = 'flutterwave'
 WHERE flutterwave_transfer_id IS NOT NULL
   AND provider = 'payhero';

-- ----------------------------------------------------------------------
-- webhook_deliveries: dedup table for inbound webhooks. Survives
-- provider retries. UNIQUE(provider, event_id) is the dedup key.
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            BIGSERIAL PRIMARY KEY,
  provider      TEXT        NOT NULL,
  event_id      TEXT        NOT NULL,
  event_type    TEXT,
  signature_ok  BOOLEAN     NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  body          JSONB       NOT NULL,
  error         TEXT,
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_received
  ON webhook_deliveries (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_provider_received
  ON webhook_deliveries (provider, received_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_deliveries_admin ON webhook_deliveries;
CREATE POLICY webhook_deliveries_admin ON webhook_deliveries
  FOR ALL USING (has_role('admin') OR has_role('superadmin'));

-- ----------------------------------------------------------------------
-- payment_attempts: audit trail for every initiate call. Lets us debug
-- "user says they paid but no record exists" by inspecting what we
-- actually sent and what came back.
-- ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_attempts (
  id                BIGSERIAL PRIMARY KEY,
  order_id          BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  provider          TEXT        NOT NULL,
  attempt_type      TEXT        NOT NULL,  -- 'stk_push' | 'b2c_transfer' | 'verify' | 'refund'
  request_payload   JSONB,
  response_payload  JSONB,
  http_status       INT,
  status            TEXT        NOT NULL,  -- 'initiated' | 'success' | 'failed' | 'error'
  error_message     TEXT,
  attempted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order
  ON payment_attempts (order_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider_attempted
  ON payment_attempts (provider, attempted_at DESC);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_attempts_admin ON payment_attempts;
CREATE POLICY payment_attempts_admin ON payment_attempts
  FOR ALL USING (has_role('admin') OR has_role('superadmin'));

-- Self-read: a distributor or customer can see attempts on their own
-- orders. Useful for support narratives.
DROP POLICY IF EXISTS payment_attempts_self_read ON payment_attempts;
CREATE POLICY payment_attempts_self_read ON payment_attempts
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
  );

-- ----------------------------------------------------------------------
-- Helper: a tiny RPC to record a webhook delivery atomically. Returns
-- TRUE if this is the first time we've seen this event (caller should
-- process it), FALSE if it's a duplicate (caller should ack 200 and
-- skip). Centralises the idempotency contract.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_webhook_delivery(
  p_provider     TEXT,
  p_event_id     TEXT,
  p_event_type   TEXT,
  p_signature_ok BOOLEAN,
  p_body         JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  INSERT INTO webhook_deliveries (
    provider, event_id, event_type, signature_ok, body
  ) VALUES (
    p_provider, p_event_id, p_event_type, p_signature_ok, p_body
  )
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING TRUE INTO v_inserted;

  RETURN COALESCE(v_inserted, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_webhook_delivery(
  TEXT, TEXT, TEXT, BOOLEAN, JSONB
) TO service_role;

-- ----------------------------------------------------------------------
-- Helper: mark a webhook delivery as processed (or failed). Called after
-- the side effects of the event have been applied.
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_webhook_processed(
  p_provider TEXT,
  p_event_id TEXT,
  p_error    TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE webhook_deliveries
     SET processed_at = NOW(),
         error        = p_error
   WHERE provider = p_provider
     AND event_id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_webhook_processed(TEXT, TEXT, TEXT) TO service_role;

-- ----------------------------------------------------------------------
-- Audit log entry for the migration itself.
-- ----------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '019_payment_provider',
  jsonb_build_object(
    'description',
    'Added PayHero columns to orders+payouts, webhook_deliveries dedup table, payment_attempts audit table, and idempotency RPCs.'
  )
);
