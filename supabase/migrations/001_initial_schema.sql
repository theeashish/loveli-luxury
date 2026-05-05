-- =============================================================================
-- LOVELI LUXURY INTERNATIONAL — INITIAL SCHEMA MIGRATION
-- =============================================================================
-- Project:        Loveli Luxury International ecommerce + MLM platform
-- Migration:      001_initial_schema.sql
-- Author:         Abala / NexDocs
-- Date:           5 May 2026
-- DBMS:           PostgreSQL 15+ (Supabase)
-- Currency model: All amounts stored as BIGINT in minor units (cents, 1 KES = 100 cents)
--                 to avoid floating-point arithmetic errors in commission calcs
-- Tree model:     Closure table for the 7-level downline. O(1) ancestor lookup
--                 at any depth, O(7) inserts on signup, no recursive CTEs needed
-- RLS posture:    Every table has RLS enabled. No anonymous reads except active
--                 catalog. No client write to ledger tables. Config tables write-
--                 only by superadmin
-- Versioning:     Config tables (commission rates, ranks, salaries) use
--                 effective_from / effective_until pattern. Edits create new rows,
--                 never update in place. Past commissions remain calculable on
--                 the rate that was effective at the time
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";


-- =============================================================================
-- 1. AUTH AND PROFILES
-- =============================================================================

CREATE TYPE user_role AS ENUM ('customer', 'distributor', 'admin', 'superadmin');

CREATE TABLE profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                  CITEXT NOT NULL UNIQUE,
  phone                  TEXT,                          -- E.164 format e.g. +254712345678
  full_name              TEXT NOT NULL,
  national_id            TEXT,                          -- KE national ID for distributor KYC
  date_of_birth          DATE,
  country_code           CHAR(2) NOT NULL DEFAULT 'KE',
  preferred_language     TEXT NOT NULL DEFAULT 'en',
  preferred_currency     CHAR(3) NOT NULL DEFAULT 'KES',
  marketing_consent_at   TIMESTAMPTZ,                   -- timestamp of consent capture
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         user_role NOT NULL,
  granted_by   UUID REFERENCES profiles(id),
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_active ON user_roles(user_id) WHERE revoked_at IS NULL;


-- =============================================================================
-- 2. CATALOG
-- =============================================================================

CREATE TABLE categories (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  parent_id   BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  position    INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  description       TEXT,
  category_id       BIGINT REFERENCES categories(id),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  meta_title        TEXT,
  meta_description  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A perfume can come in 30ml and 50ml as separate variants
CREATE TABLE product_variants (
  id                      BIGSERIAL PRIMARY KEY,
  product_id              BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                     TEXT NOT NULL UNIQUE,
  size_ml                 INT NOT NULL,
  retail_price_minor      BIGINT NOT NULL,             -- cents
  distributor_price_minor BIGINT NOT NULL,             -- cents (used for commission base)
  weight_g                INT,
  inventory_qty           INT NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (retail_price_minor >= 0),
  CHECK (distributor_price_minor >= 0),
  CHECK (inventory_qty >= 0)
);

-- Bundles power both retail combos (e.g. "X3 perfume gift box") and the
-- distributor starter packages from the comp plan (Package A, Package B)
CREATE TABLE bundles (
  id                       BIGSERIAL PRIMARY KEY,
  slug                     TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  description              TEXT,
  retail_price_minor       BIGINT NOT NULL,
  distributor_price_minor  BIGINT NOT NULL,
  currency                 CHAR(3) NOT NULL DEFAULT 'KES',
  is_starter_package       BOOLEAN NOT NULL DEFAULT FALSE,
  starter_package_code     TEXT,                       -- 'A' or 'B' for the comp plan starter packages
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bundle_items (
  id          BIGSERIAL PRIMARY KEY,
  bundle_id   BIGINT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  variant_id  BIGINT NOT NULL REFERENCES product_variants(id),
  quantity    INT NOT NULL CHECK (quantity > 0),
  UNIQUE (bundle_id, variant_id)
);


-- =============================================================================
-- 3. ADDRESSES AND ORDERS
-- =============================================================================

CREATE TABLE addresses (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label           TEXT,                                 -- e.g. "Home", "Office"
  recipient_name  TEXT NOT NULL,
  phone           TEXT NOT NULL,
  street_line_1   TEXT NOT NULL,
  street_line_2   TEXT,
  city            TEXT NOT NULL,
  region          TEXT,                                 -- county / state / province
  postal_code     TEXT,
  country_code    CHAR(2) NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE order_status AS ENUM (
  'pending', 'paid', 'failed', 'cancelled',
  'fulfilled', 'shipped', 'delivered', 'refunded'
);

CREATE TYPE order_kind AS ENUM (
  'retail',                  -- normal customer purchase
  'distributor_signup',      -- starter package purchase (creates distributor row)
  'distributor_restock'      -- distributor buying more stock at distributor price
);

CREATE TABLE orders (
  id                       BIGSERIAL PRIMARY KEY,
  order_number             TEXT NOT NULL UNIQUE,        -- human-readable e.g. LL-2026-000123
  user_id                  UUID REFERENCES profiles(id),  -- nullable for guest checkout
  customer_email           CITEXT NOT NULL,
  customer_phone           TEXT,
  kind                     order_kind NOT NULL DEFAULT 'retail',
  status                   order_status NOT NULL DEFAULT 'pending',
  subtotal_minor           BIGINT NOT NULL,
  shipping_minor           BIGINT NOT NULL DEFAULT 0,
  tax_minor                BIGINT NOT NULL DEFAULT 0,
  discount_minor           BIGINT NOT NULL DEFAULT 0,
  total_minor              BIGINT NOT NULL,
  currency                 CHAR(3) NOT NULL DEFAULT 'KES',
  sponsor_distributor_id   BIGINT,                      -- FK added after distributors table exists
  shipping_address_id      BIGINT REFERENCES addresses(id),
  payment_provider         TEXT,                        -- 'flutterwave'
  payment_provider_ref     TEXT,                        -- Flutterwave transaction id
  paid_at                  TIMESTAMPTZ,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (total_minor >= 0)
);

CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX idx_orders_sponsor ON orders(sponsor_distributor_id) WHERE sponsor_distributor_id IS NOT NULL;
CREATE INDEX idx_orders_payment_ref ON orders(payment_provider_ref) WHERE payment_provider_ref IS NOT NULL;

CREATE TABLE order_items (
  id                          BIGSERIAL PRIMARY KEY,
  order_id                    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id                  BIGINT REFERENCES product_variants(id),
  bundle_id                   BIGINT REFERENCES bundles(id),
  quantity                    INT NOT NULL CHECK (quantity > 0),
  unit_price_minor            BIGINT NOT NULL,
  line_total_minor            BIGINT NOT NULL,
  is_commissionable           BOOLEAN NOT NULL DEFAULT TRUE,
  commissionable_amount_minor BIGINT NOT NULL DEFAULT 0,  -- distributor price for commission base
  CONSTRAINT one_item_type CHECK (
    (variant_id IS NOT NULL AND bundle_id IS NULL) OR
    (variant_id IS NULL AND bundle_id IS NOT NULL)
  )
);

CREATE INDEX idx_order_items_order ON order_items(order_id);


-- =============================================================================
-- 4. MLM CORE
-- =============================================================================

CREATE TABLE distributors (
  id                          BIGSERIAL PRIMARY KEY,
  user_id                     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  sponsor_code                TEXT NOT NULL UNIQUE,    -- public referral code (e.g. LL-AB-7Q3K)
  sponsor_id                  BIGINT REFERENCES distributors(id),  -- direct upline
  joined_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  starter_package_id          BIGINT REFERENCES bundles(id),
  starter_paid_at             TIMESTAMPTZ,
  current_rank_id             BIGINT,                  -- FK added after config_ranks exists
  current_rank_achieved_at    TIMESTAMPTZ,
  payout_msisdn               TEXT,                    -- M-Pesa number in E.164 format
  payout_msisdn_verified_at   TIMESTAMPTZ,
  kyc_status                  TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  kyc_approved_at             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_distributors_sponsor ON distributors(sponsor_id);
CREATE INDEX idx_distributors_active ON distributors(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_distributors_rank ON distributors(current_rank_id);

-- Closure table for the 7-level tree. One row per (ancestor, descendant, depth).
-- Each distributor has a self-row at depth 0. Direct sponsor at depth 1, etc.
-- Capped at depth 7 because commissions stop there.
CREATE TABLE distributor_tree (
  ancestor_id    BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  descendant_id  BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  depth          INT NOT NULL CHECK (depth BETWEEN 0 AND 7),
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_tree_descendant_depth ON distributor_tree(descendant_id, depth);
CREATE INDEX idx_tree_ancestor_depth   ON distributor_tree(ancestor_id, depth);


-- =============================================================================
-- 5. CONFIG (SUPERADMIN-EDITABLE WITH VERSIONING)
-- =============================================================================
-- Pattern: rows are immutable once written. Edits create a new row with new
-- effective_from. Old row gets effective_until set to "now". Past commissions
-- always reference the config_id that was used at the time.

CREATE TABLE config_commission_rates (
  id                  BIGSERIAL PRIMARY KEY,
  level               INT NOT NULL CHECK (level BETWEEN 1 AND 7),
  rate_basis_points   INT NOT NULL CHECK (rate_basis_points >= 0),  -- 2000 = 20.00%
  effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until     TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE INDEX idx_commission_rates_active ON config_commission_rates(level, effective_from)
  WHERE effective_until IS NULL;

CREATE TABLE config_ranks (
  id                       BIGSERIAL PRIMARY KEY,
  rank_position            INT NOT NULL CHECK (rank_position BETWEEN 1 AND 7),
  rank_name                TEXT NOT NULL,
  emoji                    TEXT,
  min_active_recruits      INT NOT NULL DEFAULT 0,
  min_group_sales_minor    BIGINT NOT NULL DEFAULT 0,
  rank_up_bonus_minor      BIGINT NOT NULL DEFAULT 0,
  effective_from           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until          TIMESTAMPTZ,
  created_by               UUID REFERENCES profiles(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE INDEX idx_ranks_active ON config_ranks(rank_position, effective_from)
  WHERE effective_until IS NULL;

CREATE TABLE config_salary_tiers (
  id                              BIGSERIAL PRIMARY KEY,
  rank_position                   INT NOT NULL CHECK (rank_position BETWEEN 1 AND 7),
  min_personal_bottles            INT NOT NULL DEFAULT 0,
  min_team_gsv_minor              BIGINT NOT NULL DEFAULT 0,
  fixed_salary_minor              BIGINT NOT NULL DEFAULT 0,
  performance_bonus_basis_points  INT NOT NULL DEFAULT 0,    -- e.g. 200 = 2% of excess GSV
  effective_from                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until                 TIMESTAMPTZ,
  created_by                      UUID REFERENCES profiles(id),
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE config_starter_packages (
  id                  BIGSERIAL PRIMARY KEY,
  package_code        TEXT NOT NULL,
  bundle_id           BIGINT NOT NULL REFERENCES bundles(id),
  joining_fee_minor   BIGINT NOT NULL,
  effective_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until     TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 6. COMMISSION LEDGER, SALARIES, BONUSES, PAYOUTS
-- =============================================================================

CREATE TABLE commission_ledger (
  id                          BIGSERIAL PRIMARY KEY,
  distributor_id              BIGINT NOT NULL REFERENCES distributors(id),  -- recipient
  source_order_id             BIGINT NOT NULL REFERENCES orders(id),
  source_distributor_id       BIGINT NOT NULL REFERENCES distributors(id),  -- triggered the commission
  level                       INT NOT NULL CHECK (level BETWEEN 1 AND 7),
  commission_basis_minor      BIGINT NOT NULL,
  rate_basis_points           INT NOT NULL,
  amount_minor                BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency                    CHAR(3) NOT NULL DEFAULT 'KES',
  config_commission_rate_id   BIGINT NOT NULL REFERENCES config_commission_rates(id),
  earned_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payout_id                   BIGINT      -- FK added after payouts; null until paid
);

CREATE INDEX idx_commission_distributor_earned ON commission_ledger(distributor_id, earned_at DESC);
CREATE INDEX idx_commission_unpaid ON commission_ledger(distributor_id) WHERE payout_id IS NULL;
CREATE INDEX idx_commission_source_order ON commission_ledger(source_order_id);

CREATE TABLE monthly_salaries (
  id                       BIGSERIAL PRIMARY KEY,
  distributor_id           BIGINT NOT NULL REFERENCES distributors(id),
  period_year              INT NOT NULL,
  period_month             INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  rank_at_period_id        BIGINT NOT NULL REFERENCES config_ranks(id),
  personal_bottles_sold    INT NOT NULL DEFAULT 0,
  team_gsv_minor           BIGINT NOT NULL DEFAULT 0,
  qualified                BOOLEAN NOT NULL,
  fixed_salary_minor       BIGINT NOT NULL DEFAULT 0,
  performance_bonus_minor  BIGINT NOT NULL DEFAULT 0,
  total_minor              BIGINT NOT NULL DEFAULT 0,
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payout_id                BIGINT,
  UNIQUE (distributor_id, period_year, period_month)
);

CREATE TABLE rank_up_bonuses (
  id              BIGSERIAL PRIMARY KEY,
  distributor_id  BIGINT NOT NULL REFERENCES distributors(id),
  rank_id         BIGINT NOT NULL REFERENCES config_ranks(id),
  amount_minor    BIGINT NOT NULL CHECK (amount_minor >= 0),
  awarded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payout_id       BIGINT,
  UNIQUE (distributor_id, rank_id)             -- one bonus per rank per distributor, ever
);

CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed');

CREATE TABLE payouts (
  id                         BIGSERIAL PRIMARY KEY,
  distributor_id             BIGINT NOT NULL REFERENCES distributors(id),
  period_year                INT NOT NULL,
  period_month               INT NOT NULL,
  commissions_total_minor    BIGINT NOT NULL DEFAULT 0,
  salary_total_minor         BIGINT NOT NULL DEFAULT 0,
  rank_bonus_total_minor     BIGINT NOT NULL DEFAULT 0,
  retail_profit_minor        BIGINT NOT NULL DEFAULT 0,
  gross_total_minor          BIGINT NOT NULL,
  fees_minor                 BIGINT NOT NULL DEFAULT 0,
  net_total_minor            BIGINT NOT NULL,
  currency                   CHAR(3) NOT NULL DEFAULT 'KES',
  payout_method              TEXT NOT NULL DEFAULT 'mpesa',  -- mpesa, bank_transfer, card
  payout_msisdn              TEXT,
  status                     payout_status NOT NULL DEFAULT 'pending',
  flutterwave_transfer_id    TEXT,                            -- Flutterwave Transfer API ref
  initiated_at               TIMESTAMPTZ,
  completed_at               TIMESTAMPTZ,
  failure_reason             TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (distributor_id, period_year, period_month)
);

CREATE INDEX idx_payouts_status ON payouts(status, created_at DESC);
CREATE INDEX idx_payouts_distributor_period ON payouts(distributor_id, period_year DESC, period_month DESC);

-- Add deferred FKs now that referenced tables exist
ALTER TABLE commission_ledger  ADD FOREIGN KEY (payout_id) REFERENCES payouts(id);
ALTER TABLE monthly_salaries   ADD FOREIGN KEY (payout_id) REFERENCES payouts(id);
ALTER TABLE rank_up_bonuses    ADD FOREIGN KEY (payout_id) REFERENCES payouts(id);
ALTER TABLE distributors       ADD FOREIGN KEY (current_rank_id) REFERENCES config_ranks(id);
ALTER TABLE orders             ADD FOREIGN KEY (sponsor_distributor_id) REFERENCES distributors(id);


-- =============================================================================
-- 7. GSV SNAPSHOTS (denormalized for fast monthly reporting)
-- =============================================================================
-- One row per distributor per month. Computed by the monthly close job.
-- Avoids walking the closure table for every dashboard load.

CREATE TABLE gsv_snapshots (
  id                       BIGSERIAL PRIMARY KEY,
  distributor_id           BIGINT NOT NULL REFERENCES distributors(id),
  period_year              INT NOT NULL,
  period_month             INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  personal_bottles_sold    INT NOT NULL DEFAULT 0,
  personal_sales_minor     BIGINT NOT NULL DEFAULT 0,
  team_gsv_minor           BIGINT NOT NULL DEFAULT 0,    -- sum across all 7 levels of downline
  active_recruits_count    INT NOT NULL DEFAULT 0,        -- direct active recruits this period
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (distributor_id, period_year, period_month)
);


-- =============================================================================
-- 8. AUDIT LOG (mandatory for every config edit and payout action)
-- =============================================================================

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        UUID REFERENCES profiles(id),
  action          TEXT NOT NULL,                -- e.g. 'config_commission_rate.update'
  resource_type   TEXT NOT NULL,                -- e.g. 'config_commission_rates'
  resource_id     TEXT,
  before_data     JSONB,
  after_data      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor_time ON audit_log(actor_id, occurred_at DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);


-- =============================================================================
-- 9. HELPER FUNCTIONS
-- =============================================================================

-- Standard updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at      BEFORE UPDATE ON profiles      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated_at      BEFORE UPDATE ON products      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated_at        BEFORE UPDATE ON orders        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_distributors_updated_at  BEFORE UPDATE ON distributors  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Role check used by every RLS policy
CREATE OR REPLACE FUNCTION public.has_role(target_role user_role)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = target_role
      AND revoked_at IS NULL
  );
END;
$$;

-- Add a new distributor to the closure tree
-- Called once on signup. Inserts self-row at depth 0 plus all ancestor rows
-- inherited from parent, capped at depth 7
CREATE OR REPLACE FUNCTION public.add_distributor_to_tree(
  p_new_distributor_id   BIGINT,
  p_parent_distributor_id BIGINT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
  VALUES (p_new_distributor_id, p_new_distributor_id, 0);

  IF p_parent_distributor_id IS NOT NULL THEN
    INSERT INTO distributor_tree (ancestor_id, descendant_id, depth)
    SELECT t.ancestor_id, p_new_distributor_id, t.depth + 1
    FROM distributor_tree t
    WHERE t.descendant_id = p_parent_distributor_id
      AND t.depth + 1 <= 7;
  END IF;
END;
$$;

-- Generate a sponsor code (8 chars, format LL-XX-XXXX)
CREATE OR REPLACE FUNCTION public.generate_sponsor_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- omit 0/O/1/I to avoid confusion
  result TEXT := 'LL-';
  i      INT;
BEGIN
  FOR i IN 1..2 LOOP
    result := result || substr(chars, 1 + (random() * 31)::INT, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, 1 + (random() * 31)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$;


-- =============================================================================
-- 10. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on every single table
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses               ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_tree        ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_ranks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_salary_tiers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_starter_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_salaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_up_bonuses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsv_snapshots           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log               ENABLE ROW LEVEL SECURITY;

-- Catalog: anyone reads active rows. Only admin/superadmin writes.
CREATE POLICY catalog_categories_read      ON categories         FOR SELECT USING (is_active);
CREATE POLICY catalog_categories_write     ON categories         FOR ALL    USING (has_role('admin') OR has_role('superadmin'));
CREATE POLICY catalog_products_read        ON products           FOR SELECT USING (is_active);
CREATE POLICY catalog_products_write       ON products           FOR ALL    USING (has_role('admin') OR has_role('superadmin'));
CREATE POLICY catalog_variants_read        ON product_variants   FOR SELECT USING (is_active);
CREATE POLICY catalog_variants_write       ON product_variants   FOR ALL    USING (has_role('admin') OR has_role('superadmin'));
CREATE POLICY catalog_bundles_read         ON bundles            FOR SELECT USING (is_active);
CREATE POLICY catalog_bundles_write        ON bundles            FOR ALL    USING (has_role('admin') OR has_role('superadmin'));
CREATE POLICY catalog_bundle_items_read    ON bundle_items       FOR SELECT USING (true);
CREATE POLICY catalog_bundle_items_write   ON bundle_items       FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

-- Profiles: own row only. Admin sees all.
CREATE POLICY profiles_self_read    ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_self_update  ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY profiles_admin        ON profiles FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

-- User roles: read your own. Only superadmin grants/revokes.
CREATE POLICY user_roles_self_read  ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_roles_super      ON user_roles FOR ALL    USING (has_role('superadmin'));

-- Addresses: own only. Admin can read for fulfilment.
CREATE POLICY addresses_self        ON addresses FOR ALL    USING (user_id = auth.uid());
CREATE POLICY addresses_admin_read  ON addresses FOR SELECT USING (has_role('admin') OR has_role('superadmin'));

-- Orders: own only. Admin everything.
CREATE POLICY orders_self_read      ON orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY orders_admin          ON orders FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

CREATE POLICY order_items_self_read ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
);
CREATE POLICY order_items_admin     ON order_items FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

-- Distributors: own row + downline read. Admin everything.
CREATE POLICY distributors_self_read     ON distributors FOR SELECT USING (user_id = auth.uid());
CREATE POLICY distributors_self_update   ON distributors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY distributors_downline_read ON distributors FOR SELECT USING (
  id IN (
    SELECT descendant_id FROM distributor_tree
    WHERE ancestor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  )
);
CREATE POLICY distributors_admin         ON distributors FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

CREATE POLICY tree_self_read   ON distributor_tree FOR SELECT USING (
  ancestor_id   = (SELECT id FROM distributors WHERE user_id = auth.uid()) OR
  descendant_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
);
CREATE POLICY tree_admin       ON distributor_tree FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

-- Ledger tables: own read. Admin all. No client writes ever.
CREATE POLICY commission_self_read  ON commission_ledger FOR SELECT USING (
  distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
);
CREATE POLICY commission_admin      ON commission_ledger FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

CREATE POLICY salary_self_read      ON monthly_salaries FOR SELECT USING (
  distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
);
CREATE POLICY salary_admin          ON monthly_salaries FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

CREATE POLICY bonus_self_read       ON rank_up_bonuses FOR SELECT USING (
  distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
);
CREATE POLICY bonus_admin           ON rank_up_bonuses FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

CREATE POLICY payout_self_read      ON payouts FOR SELECT USING (
  distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
);
CREATE POLICY payout_admin          ON payouts FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

CREATE POLICY gsv_self_read         ON gsv_snapshots FOR SELECT USING (
  distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
);
CREATE POLICY gsv_admin             ON gsv_snapshots FOR ALL    USING (has_role('admin') OR has_role('superadmin'));

-- Config tables: any authenticated user reads, only superadmin writes
CREATE POLICY config_rates_read     ON config_commission_rates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY config_rates_super    ON config_commission_rates FOR ALL    USING (has_role('superadmin'));
CREATE POLICY config_ranks_read     ON config_ranks            FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY config_ranks_super    ON config_ranks            FOR ALL    USING (has_role('superadmin'));
CREATE POLICY config_salary_read    ON config_salary_tiers     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY config_salary_super   ON config_salary_tiers     FOR ALL    USING (has_role('superadmin'));
CREATE POLICY config_starter_read   ON config_starter_packages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY config_starter_super  ON config_starter_packages FOR ALL    USING (has_role('superadmin'));

-- Audit log: superadmin reads. Server-side functions write. No update or delete by anyone.
CREATE POLICY audit_super_read      ON audit_log FOR SELECT USING (has_role('superadmin'));
CREATE POLICY audit_insert_system   ON audit_log FOR INSERT WITH CHECK (true);


-- =============================================================================
-- 11. SEED CONFIG (initial values from compensation plan PDF)
-- =============================================================================
-- All amounts in minor units (cents). 1 KES = 100 cents.
-- Source: Loveli Luxury International Distributor Compensation Plan, page 3-5.

-- Commission rates (page 3)
INSERT INTO config_commission_rates (level, rate_basis_points, notes) VALUES
  (1, 2000, 'Direct Recruit'),
  (2,  900, 'Recruit''s Recruit'),
  (3,  500, '3rd Generation'),
  (4,  300, '4th Generation'),
  (5,  200, '5th Generation'),
  (6,  100, '6th Generation'),
  (7,  100, '7th Generation');

-- Ranks (page 4)
INSERT INTO config_ranks (rank_position, rank_name, emoji, min_active_recruits, min_group_sales_minor, rank_up_bonus_minor) VALUES
  (1, 'Starter',       '🌱',   0,            0,             0),
  (2, 'Bronze',        '🥉',   3,    3000000,        200000),    -- Kes 30,000 GSV, Kes 2,000 bonus
  (3, 'Silver',        '🥈',  10,    8000000,        500000),    -- Kes 80,000 GSV, Kes 5,000 bonus
  (4, 'Gold',          '🥇',  25,   20000000,       1500000),    -- Kes 200,000 GSV, Kes 15,000 bonus
  (5, 'Platinum',      '💎',  50,   50000000,       4000000),    -- Kes 500,000 GSV, Kes 40,000 bonus
  (6, 'Diamond',       '💠', 100,  100000000,      10000000),    -- Kes 1,000,000 GSV, Kes 100,000 bonus
  (7, 'Elite Diamond', '👑', 200,  250000000,      25000000);    -- Kes 2,500,000 GSV, Kes 250,000 bonus

-- Salary tiers (page 5)
INSERT INTO config_salary_tiers (rank_position, min_personal_bottles, min_team_gsv_minor, fixed_salary_minor, performance_bonus_basis_points) VALUES
  (1,  0,            0,         0,    0),
  (2,  5,    3000000,    200000,  100),    -- Bronze:   5 bottles, Kes 30k GSV,  Kes 2k salary,  1.0% bonus
  (3, 10,    8000000,    500000,  150),    -- Silver:  10 bottles, Kes 80k,      Kes 5k,         1.5%
  (4, 20,   20000000,   1200000,  200),    -- Gold:    20 bottles, Kes 200k,     Kes 12k,        2.0%
  (5, 30,   50000000,   2500000,  250),    -- Platinum:30 bottles, Kes 500k,     Kes 25k,        2.5%
  (6, 50,  100000000,   6000000,  300),    -- Diamond: 50 bottles, Kes 1m,       Kes 60k,        3.0%
  (7, 80,  250000000,  12000000,  350);    -- Elite:   80 bottles, Kes 2.5m,     Kes 120k,       3.5%

-- Starter package fee (page 2). The bundles themselves are seeded once products
-- are loaded into the catalog; the fee is what is added on top.
-- INSERT INTO config_starter_packages (package_code, bundle_id, joining_fee_minor) VALUES
--   ('A', :package_a_bundle_id, 50000),    -- Kes 500 join fee
--   ('B', :package_b_bundle_id, 50000);

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
