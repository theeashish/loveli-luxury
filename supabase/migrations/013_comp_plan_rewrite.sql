-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — COMP PLAN REWRITE
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      013_comp_plan_rewrite.sql
-- Author:         Abala / NexDocs
-- Date:           8 May 2026
-- Purpose:        Phase 7 wave 1 — replace the seeded 7-rank scheme with
--                 the 8-rank model derived from the client's PDF and
--                 stated anchors (option-iii: per-row override, math
--                 grounded in real construction rules).
--
-- Rules of construction (from chat):
--   - Rank bonus = 1% of that rank's team target  (Supervisor = 1% of
--     50,000 = 500, matching the user's anchor)
--   - Personal targets scale from PDF B's ratios anchored on Supervisor
--     (7,200 ÷ R1,950 = factor 3.692)
--   - Team targets scale from PDF B at factor 1.667 (50,000 ÷ R30,000)
--   - Salary tier opens at Senior Manager (position 5); scaled from
--     PDF B salaries at factor 1.667
--   - Commission rates use PDF B's Ambassador rates verbatim
--     (L1 20% / L2 10% / L3 8% / L4 5% / L5 2% / L6 1% / L7 1%)
--   - Every rank from Team Builder up requires 2 active L1 recruits
--     ("Min 2 active members on level 1" — PDF B)
--   - "Newbie" is modelled as a NULL current_rank_id — not its own row.
--     New distributors land there on starter purchase. Earns L1 only;
--     no bonuses, no salary, no level depth.
--
-- Strictness (user explicit):
--   - "MUST pay to access": joining fee is enforced at signup (admin
--     can seed config_starter_packages.joining_fee_minor); the
--     /api/distributor-signup/init route reads it in code.
--   - "Must maintain personal stock purchase": new
--     is_distributor_maintained() helper. write_commission_ledger
--     refuses to credit a recipient who is unmaintained for the
--     order's paid_at month.
--   - "Not unilevel": write_commission_ledger now GATES level rates
--     by the recipient's current rank — at rank N you earn on
--     levels 1..N only.
--
-- Versioning:
--   The schema's effective_from/effective_until pattern is honoured.
--   Existing config rows are closed out (effective_until = NOW). New
--   rows inserted with fresh effective_from. Pre-launch distributors
--   pointing at old ranks are set to NULL (Newbie); any monthly_salaries
--   FKs to old config_ranks rows remain valid because the rows persist.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Schema extensions
-- -----------------------------------------------------------------------------

-- Bump rank_position CHECK from 1..7 to 1..8 on config_ranks.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.config_ranks'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%rank_position%'
  LOOP
    EXECUTE format('ALTER TABLE config_ranks DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE config_ranks
  ADD CONSTRAINT config_ranks_rank_position_check
  CHECK (rank_position BETWEEN 1 AND 8);

-- Same bump on config_salary_tiers.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.config_salary_tiers'::regclass
       AND contype  = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%rank_position%'
  LOOP
    EXECUTE format('ALTER TABLE config_salary_tiers DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE config_salary_tiers
  ADD CONSTRAINT config_salary_tiers_rank_position_check
  CHECK (rank_position BETWEEN 1 AND 8);

-- New column: monthly personal-sales target in minor units.
-- `notes` is referenced by this migration's config_ranks seed below but was
-- historically first CREATEd in migration 014 — so a from-scratch replay
-- (disaster recovery, CI, integration tests) failed here. Added idempotently
-- so replay is clean; on the live DB (where the column already exists) this is
-- a no-op. See docs/site-review (migration-replay hygiene).
ALTER TABLE config_ranks
  ADD COLUMN IF NOT EXISTS min_personal_sales_minor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;


-- -----------------------------------------------------------------------------
-- 2. Close out the migration-001 seed rows so they stop being "active"
-- -----------------------------------------------------------------------------
-- We keep them around so historical FKs (commission_ledger.config_commission_rate_id,
-- monthly_salaries.rank_at_period_id) remain valid.

UPDATE config_ranks
   SET effective_until = NOW()
 WHERE effective_until IS NULL;

UPDATE config_commission_rates
   SET effective_until = NOW()
 WHERE effective_until IS NULL;

UPDATE config_salary_tiers
   SET effective_until = NOW()
 WHERE effective_until IS NULL;

-- Pre-launch posture: any existing distributors pointing at the old
-- 7-rank scheme are pushed back to "Newbie" (NULL) so they re-rank under
-- the new rules at the next monthly close. Safe because real launch
-- data does not yet exist.
UPDATE distributors
   SET current_rank_id = NULL,
       current_rank_achieved_at = NULL
 WHERE current_rank_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 3. New seed — 8 ranks
-- -----------------------------------------------------------------------------
-- All amounts in minor units (cents). 1 KES = 100 cents.
-- min_active_recruits maps to PDF B's "Min 2 active members on L1" rule.

INSERT INTO config_ranks (
  rank_position, rank_name, emoji,
  min_active_recruits, min_group_sales_minor, rank_up_bonus_minor,
  min_personal_sales_minor, notes
) VALUES
  -- pos, name,                emoji, actives, team(minor),  bonus(minor), personal(minor), notes
  (1, 'Team Builder',      '🌱', 2,    1000000,      10000,    250000,
       'Entry rank after starter package. Earns L1 only.'),
  (2, 'Team Leader',       '🌿', 2,    2500000,      25000,    450000,
       'Earns L1 + L2.'),
  (3, 'Supervisor',        '🥉', 2,    5000000,      50000,    720000,
       'Earns L1 + L2 + L3. (Client anchor: personal 7,200 / team 50,000 / bonus 500.)'),
  (4, 'Manager',           '🥈', 2,   10000000,     100000,   1000000,
       'Earns L1..L4.'),
  (5, 'Senior Manager',    '🥇', 2,   20000000,     200000,   1250000,
       'Earns L1..L5. Lifetime monthly salary opens here.'),
  (6, 'Executive Manager', '💎', 2,   37500000,     375000,   1500000,
       'Earns L1..L6.'),
  (7, 'Legacy Builder',    '👑', 2,   85000000,     850000,   1800000,
       'Earns L1..L7.'),
  (8, 'Ambassador',        '⭐', 2,  170000000,    1700000,   2250000,
       'Top rank. Full L1..L7 at the Ambassador rate sheet.');


-- -----------------------------------------------------------------------------
-- 4. New seed — commission rates (basis points). PDF B Ambassador rates.
-- -----------------------------------------------------------------------------
INSERT INTO config_commission_rates (level, rate_basis_points, notes) VALUES
  (1, 2000, 'Direct Recruit'),
  (2, 1000, '2nd Generation'),
  (3,  800, '3rd Generation'),
  (4,  500, '4th Generation'),
  (5,  200, '5th Generation'),
  (6,  100, '6th Generation'),
  (7,  100, '7th Generation');


-- -----------------------------------------------------------------------------
-- 5. New seed — salary tiers
-- -----------------------------------------------------------------------------
-- min_personal_bottles is unused by the new is_distributor_maintained
-- helper (we read personal_sales_minor from config_ranks instead), but
-- the column is NOT NULL so we set 0. Rank-up requires hitting BOTH the
-- team target on the rank AND maintaining personal. Salary kicks in
-- from Senior Manager onward.

INSERT INTO config_salary_tiers (
  rank_position, min_personal_bottles, min_team_gsv_minor,
  fixed_salary_minor, performance_bonus_basis_points
) VALUES
  (1, 0,           0,          0, 0),
  (2, 0,           0,          0, 0),
  (3, 0,           0,          0, 0),
  (4, 0,           0,          0, 0),
  (5, 0,    20000000,    1750000, 0),   -- Senior Manager:    17,500 KES
  (6, 0,    37500000,    3375000, 0),   -- Executive Manager: 33,750 KES
  (7, 0,    85000000,    6000000, 0),   -- Legacy Builder:    60,000 KES
  (8, 0,   170000000,   10000000, 0);   -- Ambassador:       100,000 KES


-- -----------------------------------------------------------------------------
-- 6. is_distributor_maintained(distributor_id, year, month)
-- -----------------------------------------------------------------------------
-- "Maintained" = the distributor personally bought stock worth at least
-- their current rank's min_personal_sales_minor in the given calendar
-- month. We sum every order WHERE user_id = distributor.user_id, status
-- ∈ paid|fulfilled|shipped|delivered, paid_at in the period.
--
-- For Newbie (current_rank_id IS NULL) we use the rank-1 threshold
-- (Team Builder's min_personal_sales_minor). That keeps the starter-
-- package purchase as the first month's maintenance.

CREATE OR REPLACE FUNCTION public.is_distributor_maintained(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id         UUID;
  v_required_minor  BIGINT;
  v_period_start    TIMESTAMPTZ;
  v_period_end      TIMESTAMPTZ;
  v_actual_minor    BIGINT;
BEGIN
  SELECT d.user_id, cr.min_personal_sales_minor
    INTO v_user_id, v_required_minor
    FROM distributors d
    LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
   WHERE d.id = p_distributor_id;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Newbie: fall back to the Team Builder threshold (rank 1's active row).
  IF v_required_minor IS NULL THEN
    SELECT min_personal_sales_minor INTO v_required_minor
      FROM config_ranks
     WHERE rank_position = 1
       AND effective_until IS NULL
     ORDER BY effective_from DESC LIMIT 1;
    v_required_minor := COALESCE(v_required_minor, 0);
  END IF;

  IF v_required_minor = 0 THEN
    RETURN TRUE;  -- no threshold configured → vacuously maintained
  END IF;

  v_period_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC');
  v_period_end   := v_period_start + INTERVAL '1 month';

  SELECT COALESCE(SUM(o.total_minor), 0)::BIGINT
    INTO v_actual_minor
    FROM orders o
   WHERE o.user_id = v_user_id
     AND o.status IN ('paid','fulfilled','shipped','delivered')
     AND o.paid_at >= v_period_start
     AND o.paid_at <  v_period_end;

  RETURN v_actual_minor >= v_required_minor;
END;
$$;

REVOKE ALL ON FUNCTION public.is_distributor_maintained(BIGINT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_distributor_maintained(BIGINT, INT, INT)
  TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 7. write_commission_ledger — rank-gating + maintenance check
-- -----------------------------------------------------------------------------
-- The compressed-vs-plain branching from migration 012 is preserved. In
-- addition, every candidate recipient is checked against:
--
--   a) RANK GATE — recipient at rank R earns on levels 1..R only.
--      Newbie (NULL rank) earns L1 only.
--
--   b) MAINTENANCE GATE — recipient must satisfy
--      is_distributor_maintained() for the order's paid_at month.
--      Unmaintained distributors get no commission for that order.
--
-- Both gates are "skip this recipient/level" — they don't error.

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
  v_period_year           INT;
  v_period_month          INT;
  rec                     RECORD;
  v_rate_id               BIGINT;
  v_rate_bp               INT;
  v_amount                BIGINT;
  v_recipient_rank_pos    INT;
  v_recipient_max_level   INT;
  v_maintained            BOOLEAN;
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
  v_period_year  := EXTRACT(YEAR  FROM v_paid_at AT TIME ZONE 'UTC')::INT;
  v_period_month := EXTRACT(MONTH FROM v_paid_at AT TIME ZONE 'UTC')::INT;

  v_compression_enabled := public.get_setting_bool(
    'commission_compression_enabled', FALSE
  );

  FOR rec IN
    WITH chain AS (
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
    -- Rank gate: at rank R, recipient earns levels 1..R only.
    -- Newbie (NULL current_rank_id) earns L1 only.
    SELECT cr.rank_position INTO v_recipient_rank_pos
      FROM distributors d
      LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
     WHERE d.id = rec.recipient_distributor_id;

    v_recipient_max_level := COALESCE(v_recipient_rank_pos, 1);

    IF rec.commission_level > v_recipient_max_level THEN
      CONTINUE;
    END IF;

    -- Maintenance gate: recipient must be maintained for paid_at's month.
    v_maintained := public.is_distributor_maintained(
      rec.recipient_distributor_id, v_period_year, v_period_month
    );
    IF NOT v_maintained THEN
      CONTINUE;
    END IF;

    -- Active rate at this level at paid_at.
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
      'rows_written',           v_count,
      'basis_minor',            v_basis_minor,
      'sponsor_distributor_id', v_sponsor_distributor,
      'compression_enabled',    v_compression_enabled,
      'period_year',            v_period_year,
      'period_month',           v_period_month
    )
  );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_commission_ledger(BIGINT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_commission_ledger(BIGINT) TO service_role;


-- -----------------------------------------------------------------------------
-- 8. detect_rank_up — treat NULL current_rank_id as position 0
-- -----------------------------------------------------------------------------
-- The migration-006 version COALESCEd a NULL current_rank_id to 1, which
-- silently blocked the first promotion (current 1 vs target 1). The new
-- comp plan uses NULL to mean "Newbie" — definitionally below rank 1.
-- Re-stating the function so the COALESCE is to 0.

CREATE OR REPLACE FUNCTION public.detect_rank_up(
  p_distributor_id BIGINT,
  p_year           INT,
  p_month          INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_end             TIMESTAMPTZ;
  v_team_gsv               BIGINT;
  v_active_recruits        INT;
  v_current_rank_position  INT := 0;
  v_target_rank_id         BIGINT;
  v_target_rank_position   INT;
  v_target_bonus_minor     BIGINT;
  v_maintained             BOOLEAN;
BEGIN
  v_period_end := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'UTC')
                  + INTERVAL '1 month';

  SELECT team_gsv_minor, active_recruits_count
    INTO v_team_gsv, v_active_recruits
    FROM gsv_snapshots
   WHERE distributor_id = p_distributor_id
     AND period_year   = p_year
     AND period_month  = p_month;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Maintenance is a hard pre-condition for any rank-up.
  v_maintained := public.is_distributor_maintained(p_distributor_id, p_year, p_month);
  IF NOT v_maintained THEN
    RETURN NULL;
  END IF;

  SELECT cr.rank_position INTO v_current_rank_position
    FROM distributors d
    LEFT JOIN config_ranks cr ON cr.id = d.current_rank_id
   WHERE d.id = p_distributor_id;
  v_current_rank_position := COALESCE(v_current_rank_position, 0);

  SELECT id, rank_position, rank_up_bonus_minor
    INTO v_target_rank_id, v_target_rank_position, v_target_bonus_minor
    FROM config_ranks
   WHERE effective_from <= v_period_end
     AND (effective_until IS NULL OR effective_until > v_period_end)
     AND min_active_recruits   <= v_active_recruits
     AND min_group_sales_minor <= v_team_gsv
   ORDER BY rank_position DESC
   LIMIT 1;

  IF NOT FOUND OR v_target_rank_position <= v_current_rank_position THEN
    RETURN NULL;
  END IF;

  UPDATE distributors
     SET current_rank_id          = v_target_rank_id,
         current_rank_achieved_at = NOW()
   WHERE id = p_distributor_id;

  IF v_target_bonus_minor > 0 THEN
    INSERT INTO rank_up_bonuses (distributor_id, rank_id, amount_minor)
    VALUES (p_distributor_id, v_target_rank_id, v_target_bonus_minor)
    ON CONFLICT (distributor_id, rank_id) DO NOTHING;
  END IF;

  INSERT INTO audit_log (action, resource_type, resource_id, after_data)
  VALUES (
    'distributor.rank_up',
    'distributors',
    p_distributor_id::TEXT,
    jsonb_build_object(
      'from_rank_position', v_current_rank_position,
      'to_rank_position',   v_target_rank_position,
      'period_year',        p_year,
      'period_month',       p_month
    )
  );

  RETURN v_target_rank_position;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_rank_up(BIGINT, INT, INT) TO service_role;

-- =============================================================================
-- END OF MIGRATION 013
-- =============================================================================
