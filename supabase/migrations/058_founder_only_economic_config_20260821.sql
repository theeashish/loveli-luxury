-- 058_founder_only_economic_config_20260821.sql
--
-- Restrict economic configuration writes to the founder superadmin only.
-- This migration does not change prices, PV formulas, commission rates,
-- compensation logic, order history, or payment behavior.
--
-- Founder admin:
--   ashishke79@gmail.com
--   41c9d33c-42d1-4c7a-88d0-a275cc517853

BEGIN;

CREATE OR REPLACE FUNCTION public.is_founder_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() = '41c9d33c-42d1-4c7a-88d0-a275cc517853'::uuid
     AND EXISTS (
       SELECT 1
         FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'superadmin'::public.user_role
          AND ur.revoked_at IS NULL
     );
$$;

REVOKE ALL ON FUNCTION public.is_founder_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_founder_admin() TO authenticated;

-- Product variant prices and related PV are economic configuration.
DROP POLICY IF EXISTS catalog_variants_write ON public.product_variants;
DROP POLICY IF EXISTS catalog_variants_founder_insert ON public.product_variants;
DROP POLICY IF EXISTS catalog_variants_founder_update ON public.product_variants;
DROP POLICY IF EXISTS catalog_variants_founder_delete ON public.product_variants;

CREATE POLICY catalog_variants_founder_insert
  ON public.product_variants
  FOR INSERT
  TO public
  WITH CHECK (public.is_founder_admin());

CREATE POLICY catalog_variants_founder_update
  ON public.product_variants
  FOR UPDATE
  TO public
  USING (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

CREATE POLICY catalog_variants_founder_delete
  ON public.product_variants
  FOR DELETE
  TO public
  USING (public.is_founder_admin());

-- Versioned commission-rate configuration.
DROP POLICY IF EXISTS config_rates_super ON public.config_commission_rates;
DROP POLICY IF EXISTS config_rates_founder_insert ON public.config_commission_rates;
DROP POLICY IF EXISTS config_rates_founder_update ON public.config_commission_rates;
DROP POLICY IF EXISTS config_rates_founder_delete ON public.config_commission_rates;

CREATE POLICY config_rates_founder_insert
  ON public.config_commission_rates
  FOR INSERT
  TO public
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_rates_founder_update
  ON public.config_commission_rates
  FOR UPDATE
  TO public
  USING (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_rates_founder_delete
  ON public.config_commission_rates
  FOR DELETE
  TO public
  USING (public.is_founder_admin());

-- Versioned rank configuration.
DROP POLICY IF EXISTS config_ranks_super ON public.config_ranks;
DROP POLICY IF EXISTS config_ranks_founder_insert ON public.config_ranks;
DROP POLICY IF EXISTS config_ranks_founder_update ON public.config_ranks;
DROP POLICY IF EXISTS config_ranks_founder_delete ON public.config_ranks;

CREATE POLICY config_ranks_founder_insert
  ON public.config_ranks
  FOR INSERT
  TO public
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_ranks_founder_update
  ON public.config_ranks
  FOR UPDATE
  TO public
  USING (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_ranks_founder_delete
  ON public.config_ranks
  FOR DELETE
  TO public
  USING (public.is_founder_admin());

-- Versioned salary-tier configuration.
DROP POLICY IF EXISTS config_salary_super ON public.config_salary_tiers;
DROP POLICY IF EXISTS config_salary_founder_insert ON public.config_salary_tiers;
DROP POLICY IF EXISTS config_salary_founder_update ON public.config_salary_tiers;
DROP POLICY IF EXISTS config_salary_founder_delete ON public.config_salary_tiers;

CREATE POLICY config_salary_founder_insert
  ON public.config_salary_tiers
  FOR INSERT
  TO public
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_salary_founder_update
  ON public.config_salary_tiers
  FOR UPDATE
  TO public
  USING (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_salary_founder_delete
  ON public.config_salary_tiers
  FOR DELETE
  TO public
  USING (public.is_founder_admin());

-- Versioned registration-fee configuration.
DROP POLICY IF EXISTS config_starter_super ON public.config_starter_packages;
DROP POLICY IF EXISTS config_starter_founder_insert ON public.config_starter_packages;
DROP POLICY IF EXISTS config_starter_founder_update ON public.config_starter_packages;
DROP POLICY IF EXISTS config_starter_founder_delete ON public.config_starter_packages;

CREATE POLICY config_starter_founder_insert
  ON public.config_starter_packages
  FOR INSERT
  TO public
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_starter_founder_update
  ON public.config_starter_packages
  FOR UPDATE
  TO public
  USING (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_starter_founder_delete
  ON public.config_starter_packages
  FOR DELETE
  TO public
  USING (public.is_founder_admin());

-- PV multiplier and other economic switches.
DROP POLICY IF EXISTS config_settings_super ON public.config_settings;
DROP POLICY IF EXISTS config_settings_founder_insert ON public.config_settings;
DROP POLICY IF EXISTS config_settings_founder_update ON public.config_settings;
DROP POLICY IF EXISTS config_settings_founder_delete ON public.config_settings;

CREATE POLICY config_settings_founder_insert
  ON public.config_settings
  FOR INSERT
  TO public
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_settings_founder_update
  ON public.config_settings
  FOR UPDATE
  TO public
  USING (public.is_founder_admin())
  WITH CHECK (public.is_founder_admin());

CREATE POLICY config_settings_founder_delete
  ON public.config_settings
  FOR DELETE
  TO public
  USING (public.is_founder_admin());

COMMIT;

NOTIFY pgrst, 'reload schema';
