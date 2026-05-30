-- 029_comp_plan_client_2026_05.sql
--
-- Configure the LIVE v1 comp engine to the client's 5-rank plan (2026-05-22).
-- This is PURE CONFIG (no engine/RPC change). The v1 engine already implements
-- the client's model:
--   * write_commission_ledger caps each upline's earned level at their
--     rank_position (rank N earns L1..N) — exactly Ambassador=L1 .. President=L5.
--   * commission amount = PV x rate% (PV-based, per the client T&C #5).
--   * detect_rank_up honours config_ranks.qualifying_months (consecutive-month
--     streak) for the one-time rank-up bonus.
--   * compute_monthly_salary pays config_salary_tiers.fixed_salary_minor monthly
--     when personal-bottle + team-GSV targets are met (the "lifestyle bonus").
--
-- DEFERRED to separate, gated engine phases (NOT in this migration):
--   (E1) Crown President "75 active customers" requirement (no field/logic yet).
--   (E2) Maintenance grace-period commission unlocking (T&C #6-7). Until built,
--        the personal-PV maintenance gate stays at 0 (off, as today).
--
-- Versioned: closes the current active rows (effective_until = NOW()) and
-- inserts fresh rows, preserving full history. Run once.

DO $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Commission rates: L1-5 = 20/11/6/2/1, L6/L7 = 0.
  UPDATE config_commission_rates SET effective_until = v_now WHERE effective_until IS NULL;
  INSERT INTO config_commission_rates (level, rate_basis_points, effective_from) VALUES
    (1, 2000, v_now),
    (2, 1100, v_now),
    (3,  600, v_now),
    (4,  200, v_now),
    (5,  100, v_now),
    (6,    0, v_now),
    (7,    0, v_now);

  -- 2. Ranks 1-5 (retire 6-8 by inserting no replacement rows for them).
  UPDATE config_ranks SET effective_until = v_now WHERE effective_until IS NULL;
  INSERT INTO config_ranks
    (rank_position, rank_name, emoji, min_active_recruits, min_group_sales_minor,
     rank_up_bonus_minor, min_personal_sales_minor, min_personal_pv,
     qualifying_months, effective_from, notes)
  VALUES
    (1, 'Ambassador',        NULL,   5,  10000000,    500000, 0, 0, 2, v_now,
       'Earns L1. Rank bonus KES 5,000 after 2 consecutive qualifying months.'),
    (2, 'Executive',         NULL,  10,  30000000,   1500000, 0, 0, 3, v_now,
       'Earns L1-2. Rank bonus KES 15,000 after 3 months. Lifestyle bonus KES 5,000/mo.'),
    (3, 'Gold Director',     NULL,  20,  75000000,   4000000, 0, 0, 3, v_now,
       'Earns L1-3. Rank bonus KES 40,000 after 3 months. Lifestyle bonus KES 20,000/mo.'),
    (4, 'Platinum Director', NULL,  50, 250000000,  12000000, 0, 0, 2, v_now,
       'Earns L1-4. Rank bonus KES 120,000 after 2 months. Lifestyle bonus KES 100,000/mo.'),
    (5, 'Crown President',   NULL, 120, 750000000,  30000000, 0, 0, 3, v_now,
       'Earns L1-5. Rank bonus KES 300,000 after 3 months. Lifestyle bonus KES 250,000/mo. DEFERRED: 75-active-customers requirement (engine).');

  -- 3. Salary tiers = monthly lifestyle bonus. Personal bottles + team GSV gate.
  UPDATE config_salary_tiers SET effective_until = v_now WHERE effective_until IS NULL;
  INSERT INTO config_salary_tiers
    (rank_position, min_personal_bottles, min_team_gsv_minor, fixed_salary_minor,
     performance_bonus_basis_points, effective_from)
  VALUES
    (1,  5,  10000000,        0, 0, v_now),
    (2, 10,  30000000,   500000, 0, v_now),
    (3, 15,  75000000,  2000000, 0, v_now),
    (4, 25, 250000000, 10000000, 0, v_now),
    (5, 35, 750000000, 25000000, 0, v_now);

  -- 4. Product PV + prices (loveli-signature; template values for the real catalog).
  --    30ml: PV 350, IBO (distributor) KES 700, retail KES 1,500 (unchanged).
  --    50ml: PV 700, IBO KES 1,400 (unchanged), retail KES 2,800.
  UPDATE product_variants
     SET pv_per_bottle = 350, distributor_price_minor = 70000,
         retail_price_minor = 150000, selling_price_minor = 150000
   WHERE sku = 'LL-SIG-30';
  UPDATE product_variants
     SET pv_per_bottle = 700, distributor_price_minor = 140000,
         retail_price_minor = 280000, selling_price_minor = 280000
   WHERE sku = 'LL-SIG-50';

  -- 5. Audit.
  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'config.comp_plan_updated',
    'comp_plan',
    '029_comp_plan_client_2026_05',
    jsonb_build_object(
      'description',
      'Client 5-rank plan: rates 20/11/6/2/1 (L6/L7=0); ranks Ambassador..Crown President (retire 6-8); lifestyle bonuses via salary tiers; 30ml PV350/IBO700, 50ml PV700/retail2800. Deferred: active-customers, grace-period maintenance.'
    )
  );
END $$;

-- DOWN (manual): re-version back to the prior active set (no automatic down).
