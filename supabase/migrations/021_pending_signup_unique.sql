-- 021_pending_signup_unique.sql
--
-- PayHero double-charge fix. Closes the duplicate-init hole that caused
-- two STK pushes (and two PayHero wallet fees) per single checkout
-- attempt. Three database changes:
--
--   1. Backfill cleanup. Existing rows in production already contain
--      the bug's evidence — pre-fix duplicate pending orders for the
--      same (user_id, kind) pair. We cancel all but the most recent
--      pending row per user per kind before creating the unique index,
--      otherwise the index creation fails with 23505.
--
--      We use 'cancelled' here (not 'expired') for two reasons:
--        - 'cancelled' already exists in the order_status enum and
--          can therefore be USED in the same transaction as the
--          ALTER TYPE below (PG forbids using a freshly-added enum
--          value inside the same transaction that added it).
--        - The historical duplicates were never paid, so 'cancelled'
--          is the most honest legacy label. Going forward, the app
--          uses 'expired' for the new abandoned-pending sweep.
--
--   2. Add 'expired' to the order_status enum. The init route uses
--      this to flip an abandoned pending order out of the way before
--      creating a fresh one (after the 15-minute reuse window).
--      Semantically distinct from 'cancelled' (user-initiated cancel)
--      and 'failed' (provider reported failure).
--
--   3. Partial unique indexes enforcing "at most one pending order per
--      user per kind" at the database level. Belt-and-braces guard
--      against the app-layer idempotency check ever regressing, and
--      against true races between two concurrent inits.
--
-- Idempotent — safe to re-run.

-- ---------------------------------------------------------------------
-- 1. Backfill: cancel pre-fix duplicate pending orders, keep the most
--    recent one per (user_id, kind). Logs an audit_log row per cancel
--    so the cleanup is reviewable.
-- ---------------------------------------------------------------------

WITH ranked AS (
  SELECT id,
         user_id,
         order_number,
         kind,
         created_at,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, kind
           ORDER BY created_at DESC, id DESC
         ) AS rn
    FROM orders
   WHERE status = 'pending'
     AND user_id IS NOT NULL
     AND kind IN ('distributor_signup', 'retail')
),
to_cancel AS (
  SELECT id, user_id, order_number, kind, created_at
    FROM ranked
   WHERE rn > 1
),
cancelled AS (
  UPDATE orders
     SET status = 'cancelled'
   WHERE id IN (SELECT id FROM to_cancel)
  RETURNING id, user_id, order_number, kind, created_at
)
INSERT INTO audit_log (action, resource_type, resource_id, after_data)
SELECT
  'migration.021.cancel_duplicate_pending',
  'order',
  c.id::text,
  jsonb_build_object(
    'reason',
    'pre-fix duplicate pending order cancelled by migration 021',
    'order_number', c.order_number,
    'kind',         c.kind,
    'user_id',      c.user_id,
    'created_at',   c.created_at
  )
FROM cancelled c;

-- ---------------------------------------------------------------------
-- 2. Enum addition. Now safe to add — the cleanup above already
--    committed (or, in autocommit mode, runs in its own statement).
--    Either way, no statement below USES 'expired'.
-- ---------------------------------------------------------------------

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'expired';

-- ---------------------------------------------------------------------
-- 3. Partial unique indexes. With duplicates removed above, both
--    creations should succeed cleanly.
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_pending_signup_per_user
  ON orders (user_id)
  WHERE status = 'pending' AND kind = 'distributor_signup';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_pending_retail_per_user
  ON orders (user_id)
  WHERE status = 'pending' AND kind = 'retail';

-- ---------------------------------------------------------------------
-- 4. Audit log entry for the migration itself.
-- ---------------------------------------------------------------------

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '021_pending_signup_unique',
  jsonb_build_object(
    'description',
    'Backfilled pre-fix duplicate pending orders to cancelled, added order_status=expired, created partial unique indexes preventing two pending orders per user per kind. Closes the PayHero double-STK-push hole.'
  )
);

-- DOWN (manual):
--
--   DROP INDEX IF EXISTS idx_orders_one_pending_signup_per_user;
--   DROP INDEX IF EXISTS idx_orders_one_pending_retail_per_user;
--
-- The 'expired' enum value cannot be removed without recreating the
-- type. Leaving it in is harmless even if the indexes are dropped.
-- The cancelled backfill is not reversible — by design; those orders
-- were never paid and should remain in their cancelled state.
