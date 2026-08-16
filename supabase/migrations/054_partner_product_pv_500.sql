-- Loveli Luxury: product PV update for the partner earnings change.
-- Scope: update product PV only. Do not change size_ml, retail prices,
-- distributor prices, wholesale logic, cart behavior, or order history.
-- Review locally first. Do not apply to production until deployment approval.

BEGIN;

DO $$
DECLARE
  affected_count integer;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM public.product_variants
  WHERE pv_per_bottle = 700;
  RAISE NOTICE 'Product variants with PV 700 before update: %', affected_count;
END $$;

UPDATE public.product_variants
SET pv_per_bottle = 500
WHERE pv_per_bottle = 700;

INSERT INTO public.audit_log (actor_id, action, resource_type, after_data)
VALUES (
  NULL,
  'product_pv_update',
  'product_variants',
  jsonb_build_object(
    'from_pv_per_bottle', 700,
    'to_pv_per_bottle', 500,
    'scope', 'Only product PV values. Prices and size_ml unchanged.'
  )
);

COMMIT;

SELECT id, sku, product_id, size_ml, pv_per_bottle,
       retail_price_minor, distributor_price_minor
FROM public.product_variants
WHERE pv_per_bottle = 500
ORDER BY id;
