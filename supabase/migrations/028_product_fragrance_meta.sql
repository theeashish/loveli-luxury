-- 028_product_fragrance_meta.sql
--
-- Per-product fragrance detail for the product page (notes pyramid,
-- performance, occasions, story, scent family, inspired-by). The DB stays the
-- source of truth for price / inventory / active status; THIS table is the
-- source of truth for the marketing detail rendered on /p/[slug].
--
-- 1:1 with products (product_id PK). Every field is nullable / default-empty,
-- so a product with no row simply renders no detail block (graceful). It is
-- public marketing copy, so anyone may read; admins manage it via
-- /admin/catalog/products/[id].
--
-- Additive. Idempotent.

CREATE TABLE IF NOT EXISTS product_fragrance_meta (
  product_id    BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  top_notes     TEXT[] NOT NULL DEFAULT '{}',
  heart_notes   TEXT[] NOT NULL DEFAULT '{}',
  base_notes    TEXT[] NOT NULL DEFAULT '{}',
  longevity     TEXT,
  projection    TEXT,
  climate_note  TEXT,
  occasions     TEXT[] NOT NULL DEFAULT '{}',
  story         TEXT,
  scent_family  TEXT,
  inspired_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES profiles(id)
);

ALTER TABLE product_fragrance_meta ENABLE ROW LEVEL SECURITY;

-- Public marketing copy: anyone may read.
DROP POLICY IF EXISTS product_fragrance_meta_public_read ON product_fragrance_meta;
CREATE POLICY product_fragrance_meta_public_read ON product_fragrance_meta
  FOR SELECT USING (TRUE);

-- Admins manage everything (the service-role client bypasses RLS regardless).
DROP POLICY IF EXISTS product_fragrance_meta_admin_all ON product_fragrance_meta;
CREATE POLICY product_fragrance_meta_admin_all ON product_fragrance_meta
  FOR ALL USING (has_role('admin')) WITH CHECK (has_role('admin'));

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
SELECT
  'migration.applied',
  'migration',
  '028_product_fragrance_meta',
  jsonb_build_object(
    'description',
    'Per-product fragrance detail table (notes/performance/occasions/story/scent_family/inspired_by), RLS public-read / admin-all.'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM audit_log
  WHERE resource_type = 'migration' AND resource_id = '028_product_fragrance_meta'
);

-- DOWN (manual):
--   DROP TABLE IF EXISTS product_fragrance_meta;
