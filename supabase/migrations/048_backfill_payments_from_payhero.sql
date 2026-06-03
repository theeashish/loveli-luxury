-- =============================================================================
-- 048_backfill_payments_from_payhero.sql
-- =============================================================================
-- Migration:   048_backfill_payments_from_payhero.sql
-- Date:        2026-06-03
-- Purpose:     Phase 0c of the PayHero → IntaSend cutover. Backfills the
--              new `payments` table (created by 047) from the historical
--              PayHero data still sitting in `orders.payhero_*` columns.
--
-- Why:         The owner directive on this migration was "Do not delete
--              historical payment data — migrate it." The PayHero
--              references on past orders are AML/audit history and may
--              be needed for refund correlation or accounting
--              reconciliation; they are preserved twice — left in the
--              `orders.payhero_*` columns (nullable, untouched), AND
--              copied into the new `payments` schema so admin tooling
--              that reads from `payments` can see them too.
--
-- Mapping:
--   payments.invoice_id      ← orders.payhero_checkout_reference
--                              (the unique IntaSend-equivalent identifier
--                              for the PayHero transaction)
--   payments.channel         ← 'mpesa'  (PayHero only ever dispatched
--                              M-Pesa for this platform; no card / bank)
--   payments.status          ← derived from orders.status:
--                                'paid'      → 'complete'
--                                'cancelled' → 'failed'
--                                'expired'   → 'failed'
--                                else        → 'pending'
--   payments.amount_cents    ← orders.total_minor
--   payments.currency        ← orders.currency
--   payments.user_id         ← orders.user_id
--   payments.order_id        ← orders.id
--   payments.raw_payload     ← jsonb composing the three payhero_* fields
--                              + the provider label + a backfill marker.
--                              Lets future audit reads tell at-a-glance
--                              that this row was synthesised from the
--                              legacy schema, not received from a live
--                              IntaSend webhook.
--   payments.created_at      ← orders.created_at  (so the temporal
--                              ordering of historical payments matches
--                              when they actually happened)
--   payments.updated_at      ← orders.updated_at
--
-- Idempotent: the UNIQUE(invoice_id) index on payments + an ON CONFLICT
--             DO NOTHING means re-running this migration inserts no
--             duplicates if any rows already exist with the same
--             invoice_id (e.g. partial-backfill recovery).
--
-- Bounds:     Only orders WHERE payhero_checkout_reference IS NOT NULL.
--             Orders that never reached the STK push stage (e.g. pending
--             cart abandons that timed out before init) are not
--             backfilled — they have no provider transaction to record.
-- =============================================================================

INSERT INTO payments (
  user_id,
  order_id,
  invoice_id,
  amount_cents,
  currency,
  channel,
  status,
  raw_payload,
  created_at,
  updated_at
)
SELECT
  o.user_id,
  o.id,
  o.payhero_checkout_reference,
  o.total_minor,
  o.currency,
  'mpesa',
  CASE o.status::text
    WHEN 'paid'      THEN 'complete'
    WHEN 'cancelled' THEN 'failed'
    WHEN 'expired'   THEN 'failed'
    ELSE                  'pending'
  END,
  jsonb_build_object(
    'provider',                   'payhero',
    'payhero_checkout_reference', o.payhero_checkout_reference,
    'payhero_external_reference', o.payhero_external_reference,
    'payhero_mpesa_receipt',      o.payhero_mpesa_receipt,
    'backfill',                   'migration_048_payhero_to_intasend',
    'order_status_at_backfill',   o.status::text,
    'paid_at',                    o.paid_at
  ),
  o.created_at,
  o.updated_at
FROM orders o
WHERE o.payhero_checkout_reference IS NOT NULL
ON CONFLICT (invoice_id) DO NOTHING;

-- Verify and log the count. The audit log row carries the exact number
-- of payments rows synthesised so future DR/forensic reads can confirm
-- the backfill ran completely.
DO $$
DECLARE
  v_orders_with_payhero INT;
  v_payments_backfilled INT;
BEGIN
  SELECT COUNT(*) INTO v_orders_with_payhero
    FROM orders
   WHERE payhero_checkout_reference IS NOT NULL;

  SELECT COUNT(*) INTO v_payments_backfilled
    FROM payments
   WHERE raw_payload->>'backfill' = 'migration_048_payhero_to_intasend';

  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'migration.applied',
    'migration',
    '048_backfill_payments_from_payhero',
    jsonb_build_object(
      'orders_with_payhero_reference', v_orders_with_payhero,
      'payments_rows_after_backfill',  v_payments_backfilled,
      'phase',                         '0c',
      'note',
      'Historical PayHero transactions copied into payments table. orders.payhero_* columns retained (nullable) for double-source audit.'
    )
  );

  RAISE NOTICE 'Backfilled % payments rows from % orders with payhero_checkout_reference.',
    v_payments_backfilled, v_orders_with_payhero;
END $$;

NOTIFY pgrst, 'reload schema';
