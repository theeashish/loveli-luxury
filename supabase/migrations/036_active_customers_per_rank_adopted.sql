-- 036_active_customers_per_rank_adopted.sql
--
-- Ruth's adopted compensation plan (2026-05-28) sets a per-rank active-
-- retail-customers requirement on every rank, not just Crown President.
-- E1 (migration 031) shipped the engine wiring for this — the column,
-- the snapshot field, and the qualification gate — but seeded values
-- only on Crown President at 75.
--
-- Adopted plan values:
--   Rank 1 — Ambassador        :   5 active customers
--   Rank 2 — Executive         :  20
--   Rank 3 — Gold Director     :  50
--   Rank 4 — Platinum Director :  80
--   Rank 5 — Crown President   : 130   (raised from 75)
--
-- Versioned per the established config_ranks pattern: close the current
-- row with effective_until = NOW(), insert a new row carrying the updated
-- value with effective_from = NOW(). Past-month rank evaluations against
-- the old rows continue to use their original thresholds (no retroactive
-- de-qualification); current/future evaluations pick the new rows.
--
-- Engine code is unchanged: is_distributor_qualified_for_rank and
-- detect_rank_up already gate on (min_active_customers IS NULL OR
-- active_customers >= min_active_customers). The dashboard at
-- /account/partner already renders the "Active customers" progress bar
-- whenever min_active_customers is non-null on the next rank.
--
-- Applied via MCP on 2026-05-28.

DO $$
DECLARE
  rec               RECORD;
  v_new             INT;
  v_old             INT;
  v_updated_count   INT := 0;
BEGIN
  FOR rec IN
    SELECT id, rank_position, min_active_customers
      FROM public.config_ranks
     WHERE effective_until IS NULL
     ORDER BY rank_position
  LOOP
    v_new := CASE rec.rank_position
      WHEN 1 THEN   5
      WHEN 2 THEN  20
      WHEN 3 THEN  50
      WHEN 4 THEN  80
      WHEN 5 THEN 130
      ELSE NULL
    END;

    IF v_new IS NULL THEN CONTINUE; END IF;

    v_old := rec.min_active_customers;
    IF v_old IS NOT NULL AND v_old = v_new THEN CONTINUE; END IF;

    UPDATE public.config_ranks
       SET effective_until = NOW()
     WHERE id = rec.id;

    INSERT INTO public.config_ranks (
      rank_position, rank_name, emoji,
      min_active_recruits, min_group_sales_minor, rank_up_bonus_minor,
      min_personal_sales_minor, min_personal_pv, qualifying_months,
      min_active_customers, maintenance_grace_months,
      effective_from, notes
    )
    SELECT
      rank_position, rank_name, emoji,
      min_active_recruits, min_group_sales_minor, rank_up_bonus_minor,
      min_personal_sales_minor, min_personal_pv, qualifying_months,
      v_new AS min_active_customers,
      maintenance_grace_months,
      NOW() AS effective_from,
      COALESCE(notes || E'\n', '') ||
        format(
          'E1-adopted (2026-05-28): min_active_customers = %s per Ruth''s final comp plan (was %s).',
          v_new,
          COALESCE(v_old::TEXT, 'NULL')
        )
    FROM public.config_ranks
    WHERE id = rec.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RAISE NOTICE 'Versioned % rank rows with new active-customer thresholds.', v_updated_count;
END;
$$;

INSERT INTO audit_log (action, resource_type, resource_id, after_data)
VALUES (
  'migration.applied',
  'migration',
  '036_active_customers_per_rank_adopted',
  jsonb_build_object(
    'description',
    'Ruth''s final comp plan adopted: min_active_customers set per rank (5/20/50/80/130). Versioned per established config_ranks pattern. Everything else in the plan (commission rates, PV, prices, group targets, directs, bonuses, lifestyle salaries, personal bottles) already matches the live system from migrations 029 + 031.',
    'thresholds', jsonb_build_object(
      'ambassador', 5,
      'executive', 20,
      'gold_director', 50,
      'platinum_director', 80,
      'crown_president', 130
    )
  )
);

NOTIFY pgrst, 'reload schema';
