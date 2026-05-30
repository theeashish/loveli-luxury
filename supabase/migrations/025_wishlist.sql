-- 025_wishlist.sql
--
-- Phase 4b-i — customer wishlist persistence.
--
-- A wishlist item is exactly one of:
--   product_id  → save the product (variant choice happens at ATC time)
--   bundle_id   → save the bundle (atomic — no variant choice)
--
-- The schema deliberately stores product-level (not variant-level)
-- saves: most customers think "I'd buy this Rose Noir later", not
-- "specifically the 30ml". The wishlist page surfaces variants at
-- add-to-cart time. Adjust here later if user behaviour calls for
-- variant-level granularity.
--
-- Guest wishlists live in browser localStorage only — no rows in this
-- table. On sign-in the client merges the localStorage list with any
-- existing DB rows; after that DB is the source of truth.
--
-- Additive. Idempotent.

CREATE TABLE IF NOT EXISTS wishlist_items (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  bundle_id  BIGINT REFERENCES bundles(id)  ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wishlist_one_kind CHECK (
    (product_id IS NULL) <> (bundle_id IS NULL)
  )
);

-- Prevent duplicates per user + kind. Partial unique indexes — each
-- (user_id, product_id) is unique among rows where product_id is set,
-- ditto for bundles. No collision with the cross-kind CHECK above.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_product
  ON wishlist_items (user_id, product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wishlist_user_bundle
  ON wishlist_items (user_id, bundle_id)
  WHERE bundle_id IS NOT NULL;

-- Fast list query: every read on /account/wishlist orders by added_at DESC.
CREATE INDEX IF NOT EXISTS idx_wishlist_user_added
  ON wishlist_items (user_id, added_at DESC);

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

-- Self-read / self-write. Admins do not need access — wishlists are
-- private to the user. (Add admin policy later only if support needs it.)
DROP POLICY IF EXISTS wishlist_self ON wishlist_items;
CREATE POLICY wishlist_self ON wishlist_items
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Audit log
INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '025_wishlist',
  jsonb_build_object(
    'description',
    'Added wishlist_items table (one-of product_id / bundle_id), partial unique indexes preventing duplicates per user, RLS self-only, fast user-added-at index.'
  )
);

-- DOWN (manual):
--   DROP TABLE IF EXISTS wishlist_items;
