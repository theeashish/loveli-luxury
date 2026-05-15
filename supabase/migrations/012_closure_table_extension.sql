-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — CLOSURE TABLE EXTENSION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      012_closure_table_extension.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 6 wave 3.
--                 Bumps the closure-table depth cap from 7 to 14 so the
--                 compressed-commissions code path has a deeper chain
--                 to walk. Plain (non-compressed) commissions still only
--                 pay 7 levels — the seed config_commission_rates only
--                 covers L1..L7. The deeper rows just give compression
--                 a chance to skip past inactives and still find 7 active
--                 ancestors.
-- Backfill:       For tables already populated, the deeper rows must be
--                 generated. We add an idempotent
--                 rebuild_distributor_tree_for(distributor_id) helper
--                 and call it for every existing distributor at the end
--                 of the migration. The helper uses
--                 ON CONFLICT DO UPDATE so re-running is safe.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Lift the depth CHECK constraint
-- -----------------------------------------------------------------------------
-- Postgres assigns a generated name to the inline CHECK from the original
-- CREATE TABLE. We drop by name with IF EXISTS guards (the name varies by
-- Postgres version; both common defaults are tried).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.distributor_tree'::regclass
       AND contype = 'c'
       AND conname  = 'distributor_tree_depth_check'
  ) THEN
    ALTER TABLE distributor_tree DROP CONSTRAINT distributor_tree_depth_check;
  END IF;
END $$;

-- Drop any other inline CHECK on the column, just in case.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.distributor_tree'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%depth%'
  LOOP
    EXECUTE format('ALTER TABLE distributor_tree DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE distributor_tree
  ADD CONSTRAINT distributor_tree_depth_check
    CHECK (depth BETWEEN 0 AND 14);


-- -----------------------------------------------------------------------------
-- 2. add_distributor_to_tree — extend the cap
-- -----------------------------------------------------------------------------
-- Same shape as the original migration-001 helper, just with the cap bumped
-- to 14. Self-row at depth 0 plus inherited ancestors from the parent.

CREATE OR REPLACE FUNCTION public.add_distributor_to_tree(
  p_new_distributor_id    BIGINT,
  p_parent_distributor_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
  VALUES (p_new_distributor_id, p_new_distributor_id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

  IF p_parent_distributor_id IS NOT NULL THEN
    INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
    SELECT t.ancestor_id, p_new_distributor_id, t.depth + 1
      FROM distributor_tree t
     WHERE t.descendant_id = p_parent_distributor_id
       AND t.depth + 1 <= 14
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE
      SET depth = EXCLUDED.depth;
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. rebuild_distributor_tree_for — backfill helper
-- -----------------------------------------------------------------------------
-- Walks up sponsor_id from a distributor and inserts/refreshes every
-- ancestor row up to depth 14. Idempotent. Returns the number of
-- ancestor rows touched (excluding the self-row).

CREATE OR REPLACE FUNCTION public.rebuild_distributor_tree_for(p_distributor_id BIGINT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INT := 0;
  v_current BIGINT;
  v_depth   INT := 0;
BEGIN
  -- Self-row
  INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
  VALUES (p_distributor_id, p_distributor_id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = 0;

  SELECT sponsor_id INTO v_current FROM distributors WHERE id = p_distributor_id;
  WHILE v_current IS NOT NULL AND v_depth < 14 LOOP
    v_depth := v_depth + 1;
    INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
    VALUES (v_current, p_distributor_id, v_depth)
    ON CONFLICT (ancestor_id, descendant_id) DO UPDATE
      SET depth = EXCLUDED.depth;
    v_count := v_count + 1;
    SELECT sponsor_id INTO v_current FROM distributors WHERE id = v_current;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_distributor_tree_for(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_distributor_tree_for(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_distributor_tree_for(BIGINT) TO service_role;


-- -----------------------------------------------------------------------------
-- 4. Backfill every existing distributor
-- -----------------------------------------------------------------------------
-- One-shot loop. Safe to re-run the migration; the helper is idempotent.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM distributors ORDER BY id LOOP
    PERFORM public.rebuild_distributor_tree_for(rec.id);
  END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 5. write_commission_ledger — extend the compressed-chain reach
-- -----------------------------------------------------------------------------
-- Plain (non-compressed) branch unchanged: pays L1..L7 by chain_depth+1.
-- Compressed branch now sees chain_depth 0..13 (= 14 levels of visibility)
-- and takes the top 7 active ancestors as L1..L7. Beyond that, levels
-- aren't paid (no rate config for L8+).

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

  FOR rec IN
    WITH chain AS (
      -- Plain mode looks at depths 0..6 only (7 visible levels).
      -- Compressed mode looks at depths 0..13 (14 visible levels) so it
      -- can skip up to 7 inactives in a row and still find 7 actives.
      SELECT dt.ancestor_id, dt.depth AS chain_depth, d.is_active
        FROM distributor_tree dt
        JOIN distributors    d  ON d.id = dt.ancestor_id
       WHERE dt.descendant_id = v_sponsor_distributor
         AND CASE
               WHEN v_compression_enabled THEN dt.depth BETWEEN 0 AND 13
               ELSE dt.depth BETWEEN 0 AND 6
             END
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

-- =============================================================================
-- END OF MIGRATION 012
-- =============================================================================
