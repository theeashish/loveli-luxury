-- =============================================================================
-- 050_seed_founding_fragrances.sql
-- =============================================================================
-- Migration:   050_seed_founding_fragrances.sql
-- Date:        2026-06-03
-- Purpose:     Bring DB parity with the founding-nine fragrances already
--              shipped in `src/lib/catalog/fragrance-meta.ts` and rendered
--              on the homepage's FeaturedGrid. Before this migration the
--              homepage advertised 9 bottles but `/shop` displayed only 2
--              (Rose Noir + Loveli Signature). This is the "Commercial
--              readiness: real catalog" line item lifted from the audit.
--
-- What it does:
--   - INSERTs 9 product rows, one per FRAGRANCES entry. Slugs match the
--     code's slug values so the existing /p/[slug] PDPs join correctly.
--   - INSERTs 18 product_variants (50ml + 100ml per product). The 50ml
--     pricing mirrors the canonical `LL-SIG-50` baseline already in the DB
--     (retail 2,800 KES / distributor 1,400 KES / 700 PV) so commission
--     math remains uniform. The 100ml row applies a 1.7× retail multiplier
--     (4,800 KES / 2,400 KES / 1,200 PV) reflecting the size economics
--     observed in comparable Kenya luxury fragrance pricing.
--   - All seeded SKUs follow the `LL-{INITIALS}-{ML}` convention already
--     used by `LL-SIG-50`.
--
-- What it does NOT do:
--   - Does NOT touch existing products (`rose-noir`, `loveli-signature`)
--     or the existing `founders-starter` bundle.
--   - Does NOT add images. The fragrance-meta entries reference
--     /products/{slug}.jpg which already ship on disk (the AI-baked
--     versions the photography brief flags for replacement). When the
--     owner uploads cleaner renders, the same paths are re-served.
--   - Does NOT alter pricing on the existing Loveli Signature row.
--
-- Idempotency:
--   ON CONFLICT (slug) DO NOTHING on products and ON CONFLICT (sku)
--   DO NOTHING on variants. Re-running this migration after the owner
--   tweaks prices via /admin/catalog leaves the edits intact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 1: insert the 9 founding products
-- -----------------------------------------------------------------------------

INSERT INTO products (slug, name, description, is_active)
VALUES
  (
    'ocean-desire',
    'Ocean Desire',
    E'The essence of a luxury escape.\n\nSea salt, bergamot, white amber.\n\nFor mornings that taste of horizon.'
  , true),
  (
    'coastal-sage',
    'Coastal Sage',
    E'The essence of the coast.\n\nMediterranean sage, driftwood, sea breeze.\n\nFor long walks that end in salt-silver light.'
  , true),
  (
    'crimson-noir',
    'Crimson Noir',
    E'Dark, warm, unhurried.\n\nSmoked oud, leather, aged whiskey.\n\nFor rooms warmed by candlelight and conversation.'
  , true),
  (
    'black-torque',
    'Black Torque',
    E'Experience true elegance.\n\nBlack amber, polished leather, bronzed musk.\n\nFor the cut of a tailored shoulder.'
  , true),
  (
    'afar',
    'Afar',
    E'The romance of far places.\n\nSaffron, frankincense, gilded rose.\n\nFor the romance of distant rooms.'
  , true),
  (
    'vanilla-smoke',
    'Vanilla Smoke',
    E'Soft fire, slow burn.\n\nMadagascan vanilla, cured tobacco, sandalwood.\n\nFor nights that stretch into stories.'
  , true),
  (
    'sunset-bliss',
    'Sunset Bliss',
    E'Petals at golden hour.\n\nDamask rose, jasmine sambac, soft musk.\n\nFor laughter on a balcony as the day softens.'
  , true),
  (
    'pink-allure',
    'Pink Allure',
    E'A whisper, a promise.\n\nPeony, lychee, powdered iris.\n\nFor the hush before being seen.'
  , true),
  (
    'orange-aura',
    'Orange Aura',
    E'Sunlight, but woven.\n\nBlood orange, neroli, gilded vetiver.\n\nFor doorways flung open and rooms pulled close.'
  , true)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Step 2: insert two variants per product (50ml + 100ml)
--
-- Pricing mirrors the existing `LL-SIG-50` baseline. Owner can tune via
-- /admin/catalog/variants; ON CONFLICT (sku) protects manual edits on re-run.
-- -----------------------------------------------------------------------------

WITH founding AS (
  SELECT id, slug FROM products WHERE slug IN (
    'ocean-desire','coastal-sage','crimson-noir','black-torque','afar',
    'vanilla-smoke','sunset-bliss','pink-allure','orange-aura'
  )
),
sku_map AS (
  SELECT slug, initials FROM (VALUES
    ('ocean-desire',  'OD'),
    ('coastal-sage',  'CS'),
    ('crimson-noir',  'CN'),
    ('black-torque',  'BT'),
    ('afar',          'AF'),
    ('vanilla-smoke', 'VS'),
    ('sunset-bliss',  'SB'),
    ('pink-allure',   'PA'),
    ('orange-aura',   'OA')
  ) AS t(slug, initials)
),
variant_rows AS (
  -- 50ml
  SELECT
    f.id AS product_id,
    'LL-' || s.initials || '-50' AS sku,
    50  AS size_ml,
    280000::bigint AS retail_price_minor,
    140000::bigint AS distributor_price_minor,
    700 AS pv_per_bottle,
    100 AS inventory_qty
  FROM founding f
  JOIN sku_map  s ON s.slug = f.slug

  UNION ALL

  -- 100ml
  SELECT
    f.id,
    'LL-' || s.initials || '-100',
    100,
    480000::bigint,
    240000::bigint,
    1200,
    100
  FROM founding f
  JOIN sku_map  s ON s.slug = f.slug
)
INSERT INTO product_variants (
  product_id, sku, size_ml,
  retail_price_minor, distributor_price_minor,
  pv_per_bottle, inventory_qty, is_active
)
SELECT
  product_id, sku, size_ml,
  retail_price_minor, distributor_price_minor,
  pv_per_bottle, inventory_qty, true
FROM variant_rows
ON CONFLICT (sku) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Step 3: audit log + reload schema
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_products INT;
  v_variants INT;
BEGIN
  SELECT COUNT(*) INTO v_products
  FROM products
  WHERE slug IN (
    'ocean-desire','coastal-sage','crimson-noir','black-torque','afar',
    'vanilla-smoke','sunset-bliss','pink-allure','orange-aura'
  );

  SELECT COUNT(*) INTO v_variants
  FROM product_variants
  WHERE sku LIKE 'LL-%-50' OR sku LIKE 'LL-%-100'
  AND sku <> 'LL-SIG-50';

  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'migration.applied',
    'migration',
    '050_seed_founding_fragrances',
    jsonb_build_object(
      'founding_products_present', v_products,
      'founding_variants_present', v_variants,
      'note',
      'Seeded the 9 founding fragrances + 18 variants (50ml/100ml each) at the LL-SIG-50 price baseline. Idempotent; ON CONFLICT (slug)/(sku) DO NOTHING preserves admin edits.'
    )
  );

  RAISE NOTICE '050: % founding products and % founding variants present after seed.',
    v_products, v_variants;
END $$;

NOTIFY pgrst, 'reload schema';
