-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMMISSION COMPRESSION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      009_commission_compression.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 5 wave 2.
--                 Adds a small key/value config_settings table for runtime
--                 policy flags, seeds `commission_compression_enabled =
--                 false` (opt-in by default), and replaces
--                 write_commission_ledger() with a version that honours
--                 the flag.
-- Compression:    When enabled, inactive distributors in the upline are
--                 skipped and the next active ancestor is promoted to
--                 their level slot. We deliberately do NOT extend the
--                 chain beyond the existing closure-table cap of depth 7
--                 — if there aren't enough active ancestors in the
--                 visible chain, fewer levels get paid. Extending the
--                 closure cap (and therefore the recursive compression
--                 reach) is a Phase 6 schema change.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. config_settings — generic key/value flags for runtime policy
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS config_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  notes       TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE config_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read settings (so the app can branch on them).
-- Only superadmin writes.
DROP POLICY IF EXISTS config_settings_read ON config_settings;
CREATE POLICY config_settings_read
  ON config_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS config_settings_super ON config_settings;
CREATE POLICY config_settings_super
  ON config_settings FOR ALL
  USING (has_role('superadmin'));

-- Helper: read a boolean setting with a default.
CREATE OR REPLACE FUNCTION public.get_setting_bool(
  p_key TEXT, p_default BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v JSONB;
BEGIN
  SELECT value INTO v FROM config_settings WHERE key = p_key;
  IF NOT FOUND OR v IS NULL THEN
    RETURN p_default;
  END IF;
  -- Accept either a bare boolean or the strings "true"/"false"
  IF jsonb_typeof(v) = 'boolean' THEN
    RETURN v::TEXT::BOOLEAN;
  ELSIF jsonb_typeof(v) = 'string' THEN
    RETURN (v #>> '{}')::BOOLEAN;
  ELSE
    RETURN p_default;
  END IF;
EXCEPTION WHEN others THEN
  RETURN p_default;
END;
$$;

-- Seed the compression flag in the OFF position so behaviour is unchanged
-- until a superadmin opts in.
INSERT INTO config_settings (key, value, notes)
VALUES (
  'commission_compression_enabled',
  to_jsonb(FALSE),
  'When TRUE, write_commission_ledger skips inactive ancestors and promotes the next active up to fill the level slot. Defaults FALSE.'
)
ON CONFLICT (key) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. write_commission_ledger v2 — honour compression flag
-- -----------------------------------------------------------------------------
-- Replaces the migration-004 body. Signature unchanged.
--
-- Algorithm:
--   - Build the chain: ancestors of the buyer's sponsor at depth 0..6.
--   - If compression is OFF: level = chain_depth + 1 (sponsor=L1, etc.)
--     for every row, regardless of is_active. (Original behaviour.)
--   - If compression is ON: filter to active ancestors only, then
--     ROW_NUMBER() over chain_depth → that becomes the level. Inactives
--     get no row.
--
-- Result rows still pass through the same rate-lookup + integer math as
-- before. Idempotency on source_order_id is preserved.

CREATE OR REPLACE FUNCTION public.write_commission_ledger(p_order_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status                order_status;
  v_paid_at               TIMESTAMPTZ;
  v_sponsor_distributor   BIGINT;
  v_basis_minor           BIGINT;
  v_existing              INT;
  v_count                 INT := 0;
  v_compression_enabled   BOOLEAN;
  rec                     RECORD;
  v_rate_id               BIGINT;
  v_rate_bp               INT;
  v_amount                BIGINT;
BEGIN
  SELECT status, paid_at, sponsor_distributor_id
    INTO v_status, v_paid_at, v_sponsor_distributor
    FROM orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % not found', p_order_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_status <> 'paid' THEN
    RAISE EXCEPTION 'order % is not paid (status=%)', p_order_id, v_status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_sponsor_distributor IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO v_existing
    FROM commission_ledger
   WHERE source_order_id = p_order_id;
  IF v_existing > 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(commissionable_amount_minor), 0)::BIGINT
    INTO v_basis_minor
    FROM order_items
   WHERE order_id = p_order_id
     AND is_commissionable = TRUE;

  IF v_basis_minor = 0 THEN
    RETURN 0;
  END IF;

  v_paid_at := COALESCE(v_paid_at, NOW());
  v_compression_enabled := public.get_setting_bool(
    'commission_compression_enabled', FALSE
  );

  -- Build the recipient list. Two query variants gated on the flag, both
  -- producing rows of (recipient_distributor_id, commission_level).
  FOR rec IN
    WITH chain AS (
      SELECT dt.ancestor_id, dt.depth AS chain_depth, d.is_active
        FROM distributor_tree dt
        JOIN distributors    d  ON d.id = dt.ancestor_id
       WHERE dt.descendant_id = v_sponsor_distributor
         AND dt.depth BETWEEN 0 AND 6
    ),
    compressed AS (
      SELECT ancestor_id,
             ROW_NUMBER() OVER (ORDER BY chain_depth ASC) AS lvl
        FROM chain
       WHERE is_active = TRUE
    ),
    plain AS (
      SELECT ancestor_id, chain_depth + 1 AS lvl
        FROM chain
    )
    SELECT ancestor_id AS recipient_distributor_id,
           lvl         AS commission_level
      FROM (
        SELECT ancestor_id, lvl FROM compressed
         WHERE v_compression_enabled = TRUE
        UNION ALL
        SELECT ancestor_id, lvl FROM plain
         WHERE v_compression_enabled = FALSE
      ) chosen
     WHERE lvl BETWEEN 1 AND 7
     ORDER BY commission_level ASC
  LOOP
    SELECT id, rate_basis_points
      INTO v_rate_id, v_rate_bp
      FROM config_commission_rates
     WHERE level = rec.commission_level
       AND effective_from <= v_paid_at
       AND (effective_until IS NULL OR effective_until > v_paid_at)
     ORDER BY effective_from DESC
     LIMIT 1;

    IF v_rate_id IS NULL THEN
      CONTINUE;
    END IF;

    v_amount := (v_basis_minor * v_rate_bp) / 10000;
    IF v_amount = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO commission_ledger (
      distributor_id,
      source_order_id,
      source_distributor_id,
      level,
      commission_basis_minor,
      rate_basis_points,
      amount_minor,
      currency,
      config_commission_rate_id,
      earned_at
    ) VALUES (
      rec.recipient_distributor_id,
      p_order_id,
      v_sponsor_distributor,
      rec.commission_level,
      v_basis_minor,
      v_rate_bp,
      v_amount,
      'KES',
      v_rate_id,
      v_paid_at
    );
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO audit_log (
    actor_id, action, resource_type, resource_id, after_data
  ) VALUES (
    NULL,
    'commission.ledger_written',
    'orders',
    p_order_id::TEXT,
    jsonb_build_object(
      'rows_written',          v_count,
      'basis_minor',           v_basis_minor,
      'sponsor_distributor_id', v_sponsor_distributor,
      'compression_enabled',   v_compression_enabled
    )
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_commission_ledger(BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.get_setting_bool(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_setting_bool(TEXT, BOOLEAN) TO authenticated, service_role;

-- =============================================================================
-- END OF MIGRATION 009
-- =============================================================================
