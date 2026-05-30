-- 038_per_product_reviews.sql
--
-- Lets reviews target either the homepage (product_id IS NULL — the original
-- behaviour, curated brand-wide social proof) or a specific product
-- (product_id = X — renders on the PDP). Single table keeps the admin UI
-- and RLS surface area small; the PDP fetches by product_id, the homepage
-- by product_id IS NULL.
--
-- Applied via MCP on 2026-05-28.

ALTER TABLE public.homepage_reviews
  ADD COLUMN IF NOT EXISTS product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_homepage_reviews_product_id
  ON public.homepage_reviews (product_id)
  WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.homepage_reviews.product_id IS
  'When NULL: review appears in the homepage social-proof carousel (brand-wide). '
  'When set: review appears on /p/[slug] for the referenced product only. '
  'Added 2026-05-28 for PDP overhaul (Appendix O).';

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '038_per_product_reviews',
  jsonb_build_object(
    'description',
    'Added optional product_id to homepage_reviews so the same table backs both homepage carousel reviews (product_id NULL) and PDP-specific reviews (product_id = X).'
  )
);

NOTIFY pgrst, 'reload schema';
