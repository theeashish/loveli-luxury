-- Loveli Luxury International
-- Dynamic PV policy: 0.5 PV per KES 1 of distributor price.
--
-- The distributor price is the commissionable product amount used by
-- checkout/order_items. Retail price remains a separate storefront price.
-- Product PV is derived only on product_variants. Existing order_items rows
-- are historical snapshots and are intentionally not rewritten.

BEGIN;

-- Keep the policy in the existing superadmin-controlled settings table.
INSERT INTO public.config_settings (key, value, notes)
VALUES (
  'pv_per_kes_multiplier',
  to_jsonb(0.5::numeric),
  'Product PV policy: 0.5 PV for every KES 1 of distributor price. PV is rounded down to a whole point when needed.'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    notes = EXCLUDED.notes,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.get_setting_numeric(
  p_key TEXT,
  p_default NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v JSONB;
BEGIN
  SELECT value INTO v
    FROM public.config_settings
   WHERE key = p_key;

  IF NOT FOUND OR v IS NULL THEN
    RETURN p_default;
  END IF;

  IF jsonb_typeof(v) IN ('number', 'string') THEN
    RETURN (v #>> '{}')::NUMERIC;
  END IF;

  RETURN p_default;
EXCEPTION WHEN others THEN
  RETURN p_default;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_setting_numeric(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_setting_numeric(TEXT, NUMERIC) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pv_from_distributor_price_minor(
  p_distributor_price_minor BIGINT
) RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_price_minor BIGINT := GREATEST(COALESCE(p_distributor_price_minor, 0), 0);
  v_multiplier NUMERIC := public.get_setting_numeric('pv_per_kes_multiplier', 0.5);
BEGIN
  -- Money is stored in minor units. Convert to KES, apply the policy, and
  -- round down because the total PV is an integer point value.
  RETURN FLOOR((v_price_minor::NUMERIC / 100) * v_multiplier)::INT;
END;
$function$;

REVOKE ALL ON FUNCTION public.pv_from_distributor_price_minor(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pv_from_distributor_price_minor(BIGINT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_product_variant_pv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_total_pv INTEGER;
  v_participant_pv INTEGER;
BEGIN
  v_total_pv := public.pv_from_distributor_price_minor(NEW.distributor_price_minor);
  v_participant_pv := ROUND(v_total_pv * 0.80)::INTEGER;
  NEW.pv_per_bottle := v_participant_pv;

  -- Migration 057 is deliberately safe to apply before migration 059. When
  -- the internal column exists, jsonb_populate_record fills it without a
  -- compile-time reference that would break the earlier schema.
  NEW := jsonb_populate_record(
    NEW,
    jsonb_build_object(
      'internal_pv_per_bottle', v_total_pv - v_participant_pv
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_product_variants_sync_pv ON public.product_variants;
CREATE TRIGGER trg_product_variants_sync_pv
BEFORE INSERT OR UPDATE OF distributor_price_minor, pv_per_bottle
ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_variant_pv();

-- Backfill current catalog PV from the current distributor prices. Once
-- migration 059 has added the internal column, the trigger also backfills the
-- corresponding 20% marketing/management allocation. Historical order_items
-- snapshots are intentionally not rewritten.
UPDATE public.product_variants
   SET pv_per_bottle = public.pv_from_distributor_price_minor(distributor_price_minor);

COMMENT ON COLUMN public.product_variants.pv_per_bottle IS
  'Derived participant-facing PV: 80% of total PV from distributor_price_minor using config_settings.pv_per_kes_multiplier. Historical order_items.commission_pv values are immutable snapshots.';

NOTIFY pgrst, 'reload schema';

COMMIT;
