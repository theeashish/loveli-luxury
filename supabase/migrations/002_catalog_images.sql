-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — CATALOG IMAGES MIGRATION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      002_catalog_images.sql
-- Author:         Abala / NexDocs
-- Date:           5 May 2026
-- DBMS:           PostgreSQL 15+ (Supabase)
-- Purpose:        Adds product_images and bundle_images tables, and provisions
--                 the public-read 'catalog' Storage bucket plus its RLS policies.
-- Storage layout: One row per uploaded asset. storage_prefix names a folder; the
--                 image pipeline writes three renditions inside that folder:
--                   {prefix}/original.webp   (re-encoded source, never resized)
--                   {prefix}/display.webp    (longest edge 1600)
--                   {prefix}/thumb.webp      (400x400 cover)
--                 Read-side resolves URLs by appending the rendition suffix, so
--                 we don't store three rows per image.
-- =============================================================================


-- =============================================================================
-- 1. PRODUCT IMAGES
-- =============================================================================

CREATE TABLE product_images (
  id              BIGSERIAL PRIMARY KEY,
  product_id      BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  storage_prefix  TEXT   NOT NULL,                      -- e.g. products/12/8e1c...-uuid
  alt             TEXT,
  position        INT    NOT NULL DEFAULT 0,
  width           INT,
  height          INT,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (position >= 0),
  CHECK (width  IS NULL OR width  > 0),
  CHECK (height IS NULL OR height > 0)
);

-- At most one primary image per product. Partial unique index lets the rest be
-- non-primary without collision.
CREATE UNIQUE INDEX one_primary_per_product
  ON product_images(product_id)
  WHERE is_primary;

CREATE INDEX idx_product_images_product
  ON product_images(product_id, position);

CREATE INDEX idx_product_images_variant
  ON product_images(variant_id)
  WHERE variant_id IS NOT NULL;


-- =============================================================================
-- 2. BUNDLE IMAGES
-- =============================================================================

CREATE TABLE bundle_images (
  id              BIGSERIAL PRIMARY KEY,
  bundle_id       BIGINT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  storage_prefix  TEXT   NOT NULL,                      -- e.g. bundles/3/8e1c...-uuid
  alt             TEXT,
  position        INT    NOT NULL DEFAULT 0,
  width           INT,
  height          INT,
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (position >= 0),
  CHECK (width  IS NULL OR width  > 0),
  CHECK (height IS NULL OR height > 0)
);

CREATE UNIQUE INDEX one_primary_per_bundle
  ON bundle_images(bundle_id)
  WHERE is_primary;

CREATE INDEX idx_bundle_images_bundle
  ON bundle_images(bundle_id, position);


-- =============================================================================
-- 3. RLS — IMAGE TABLES
-- =============================================================================
-- Read: public. The product_images / bundle_images rows themselves carry no
-- secret data, and the storefront needs to render them for anonymous users.
-- The corresponding products/bundles rows are already gated by is_active in
-- their own SELECT policies, so anonymous queries that join through them only
-- surface images of active catalog entries in practice.
-- Write: admin / superadmin only, matching the rest of the catalog.

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_images  ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_product_images_read
  ON product_images FOR SELECT USING (true);

CREATE POLICY catalog_product_images_write
  ON product_images FOR ALL
  USING (has_role('admin') OR has_role('superadmin'))
  WITH CHECK (has_role('admin') OR has_role('superadmin'));

CREATE POLICY catalog_bundle_images_read
  ON bundle_images FOR SELECT USING (true);

CREATE POLICY catalog_bundle_images_write
  ON bundle_images FOR ALL
  USING (has_role('admin') OR has_role('superadmin'))
  WITH CHECK (has_role('admin') OR has_role('superadmin'));


-- =============================================================================
-- 4. STORAGE BUCKET — 'catalog'
-- =============================================================================
-- Public-read CDN bucket for product and bundle imagery. Writes are gated by
-- has_role(admin|superadmin) so the only path to upload is via a signed admin
-- session or the service role.

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog', 'catalog', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;


-- Drop any pre-existing policies for idempotency in dev resets.
DROP POLICY IF EXISTS catalog_storage_read         ON storage.objects;
DROP POLICY IF EXISTS catalog_storage_admin_insert ON storage.objects;
DROP POLICY IF EXISTS catalog_storage_admin_update ON storage.objects;
DROP POLICY IF EXISTS catalog_storage_admin_delete ON storage.objects;

CREATE POLICY catalog_storage_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog');

CREATE POLICY catalog_storage_admin_insert
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catalog'
    AND (has_role('admin') OR has_role('superadmin'))
  );

CREATE POLICY catalog_storage_admin_update
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'catalog'
    AND (has_role('admin') OR has_role('superadmin'))
  )
  WITH CHECK (
    bucket_id = 'catalog'
    AND (has_role('admin') OR has_role('superadmin'))
  );

CREATE POLICY catalog_storage_admin_delete
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'catalog'
    AND (has_role('admin') OR has_role('superadmin'))
  );
