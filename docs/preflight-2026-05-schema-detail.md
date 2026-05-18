Perfect. Now I have all the migration data. Let me compile the comprehensive schema audit report.

---

# SCHEMA AUDIT — Phase 0 Preflight

## Per-Table Report

### Auth & Profiles

#### **Table: profiles**
- **Created in:** 001_initial_schema.sql
- **Purpose:** User master record. Stores authentication identity, contact info, KYC fields, language/currency preferences, and marketing consent timestamp.
- **Modified by:** None
- **Columns:**
  - `id` UUID PRIMARY KEY (FK → auth.users.id ON DELETE CASCADE)
  - `email` CITEXT NOT NULL UNIQUE
  - `phone` TEXT
  - `full_name` TEXT NOT NULL
  - `national_id` TEXT
  - `date_of_birth` DATE
  - `country_code` CHAR(2) NOT NULL DEFAULT 'KE'
  - `preferred_language` TEXT NOT NULL DEFAULT 'en'
  - `preferred_currency` CHAR(3) NOT NULL DEFAULT 'KES'
  - `marketing_consent_at` TIMESTAMPTZ
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** id REFERENCES auth.users(id) ON DELETE CASCADE
- **CHECK Constraints:** None
- **Indexes:**
  - (implicit on id)
  - idx_user_roles_active (on user_roles; see below)
- **RLS Enabled:** Yes
  - `profiles_self_read`: SELECT where id = auth.uid()
  - `profiles_self_update`: UPDATE where id = auth.uid()
  - `profiles_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** trg_profiles_updated_at (BEFORE UPDATE) → set_updated_at()

#### **Table: user_roles**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Role assignment audit trail. Links users to roles (customer, distributor, admin, superadmin) with grant/revoke timestamps and attribution.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `user_id` UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `role` user_role NOT NULL (ENUM: customer | distributor | admin | superadmin)
  - `granted_by` UUID REFERENCES profiles(id)
  - `granted_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `revoked_at` TIMESTAMPTZ
- **Primary Key:** id
- **Foreign Keys:**
  - user_id REFERENCES profiles(id) ON DELETE CASCADE
  - granted_by REFERENCES profiles(id)
- **CHECK Constraints:** None
- **Indexes:**
  - idx_user_roles_active (user_id) WHERE revoked_at IS NULL — finds active roles for a user O(1)
  - UNIQUE (user_id, role) — enforces one grant per user per role
- **RLS Enabled:** Yes
  - `user_roles_self_read`: SELECT where user_id = auth.uid()
  - `user_roles_super`: ALL where has_role('superadmin')
- **Triggers:** None

---

### Catalog

#### **Table: categories**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Hierarchical product classification. Parent categories can nest; de/active flag controls visibility.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `slug` TEXT NOT NULL UNIQUE
  - `name` TEXT NOT NULL
  - `parent_id` BIGINT REFERENCES categories(id) ON DELETE SET NULL
  - `position` INT NOT NULL DEFAULT 0
  - `is_active` BOOLEAN NOT NULL DEFAULT TRUE
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** parent_id REFERENCES categories(id) ON DELETE SET NULL
- **CHECK Constraints:** None
- **Indexes:** (implicit on id and slug)
- **RLS Enabled:** Yes
  - `catalog_categories_read`: SELECT where is_active = TRUE
  - `catalog_categories_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: products**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Base product entity. Holds name, slug, category, SEO metadata, and active status. Variants define SKUs/sizes.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `slug` TEXT NOT NULL UNIQUE
  - `name` TEXT NOT NULL
  - `description` TEXT
  - `category_id` BIGINT REFERENCES categories(id)
  - `is_active` BOOLEAN NOT NULL DEFAULT TRUE
  - `meta_title` TEXT
  - `meta_description` TEXT
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** category_id REFERENCES categories(id) (no ON DELETE — defaults to RESTRICT)
- **CHECK Constraints:** None
- **Indexes:** (implicit on id and slug)
- **RLS Enabled:** Yes
  - `catalog_products_read`: SELECT where is_active = TRUE
  - `catalog_products_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** trg_products_updated_at (BEFORE UPDATE) → set_updated_at()

#### **Table: product_variants**
- **Created in:** 001_initial_schema.sql
- **Purpose:** SKU-level entity. Tracks size, retail/distributor pricing, inventory, and PV (Point Value) for commissions. Immutable once created; inventory managed transactionally on order payment and refund.
- **Modified by:** 014_comp_plan_v2_pv.sql (added pv_per_bottle, selling_price_minor)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `product_id` BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE
  - `sku` TEXT NOT NULL UNIQUE
  - `size_ml` INT NOT NULL
  - `retail_price_minor` BIGINT NOT NULL (cents; overwritten by 014 with canonical selling price for 30ml/50ml)
  - `distributor_price_minor` BIGINT NOT NULL (cents; cost for sponsor/IBO purchases)
  - `weight_g` INT
  - `inventory_qty` INT NOT NULL DEFAULT 0
  - `is_active` BOOLEAN NOT NULL DEFAULT TRUE
  - `pv_per_bottle` INT NOT NULL DEFAULT 0 (added in 014; 30ml=550, 50ml=950)
  - `selling_price_minor` BIGINT (added in 014; canonical customer-facing price)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** product_id REFERENCES products(id) ON DELETE CASCADE
- **CHECK Constraints:**
  - retail_price_minor >= 0
  - distributor_price_minor >= 0
  - inventory_qty >= 0
- **Indexes:** (implicit on id and sku)
- **RLS Enabled:** Yes
  - `catalog_variants_read`: SELECT where is_active = TRUE
  - `catalog_variants_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: bundles**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Composite product (gift box, starter package). Wraps bundle_items; used for both retail bundles and distributor starter packages.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `slug` TEXT NOT NULL UNIQUE
  - `name` TEXT NOT NULL
  - `description` TEXT
  - `retail_price_minor` BIGINT NOT NULL (cents)
  - `distributor_price_minor` BIGINT NOT NULL (cents)
  - `currency` CHAR(3) NOT NULL DEFAULT 'KES'
  - `is_starter_package` BOOLEAN NOT NULL DEFAULT FALSE
  - `starter_package_code` TEXT (e.g., 'A' or 'B' from comp plan)
  - `is_active` BOOLEAN NOT NULL DEFAULT TRUE
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** None
- **CHECK Constraints:** None
- **Indexes:** (implicit on id and slug)
- **RLS Enabled:** Yes
  - `catalog_bundles_read`: SELECT where is_active = TRUE
  - `catalog_bundles_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: bundle_items**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Line items within a bundle. Each row is a variant + quantity pairing.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `bundle_id` BIGINT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE
  - `variant_id` BIGINT NOT NULL REFERENCES product_variants(id)
  - `quantity` INT NOT NULL (CHECK > 0)
- **Primary Key:** id
- **Foreign Keys:**
  - bundle_id REFERENCES bundles(id) ON DELETE CASCADE
  - variant_id REFERENCES product_variants(id) (no ON DELETE; defaults to RESTRICT)
- **CHECK Constraints:** quantity > 0
- **Indexes:** UNIQUE (bundle_id, variant_id) — one variant per bundle, no duplicates
- **RLS Enabled:** Yes
  - `catalog_bundle_items_read`: SELECT using TRUE
  - `catalog_bundle_items_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: product_images**
- **Created in:** 002_catalog_images.sql
- **Purpose:** Renditions (original, display, thumb) of product images. Storage-backed; alt text and positioning support.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `product_id` BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE
  - `variant_id` BIGINT REFERENCES product_variants(id) ON DELETE SET NULL
  - `storage_prefix` TEXT NOT NULL (e.g., products/12/uuid)
  - `alt` TEXT
  - `position` INT NOT NULL DEFAULT 0
  - `width` INT
  - `height` INT
  - `is_primary` BOOLEAN NOT NULL DEFAULT FALSE
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:**
  - product_id REFERENCES products(id) ON DELETE CASCADE
  - variant_id REFERENCES product_variants(id) ON DELETE SET NULL
- **CHECK Constraints:**
  - position >= 0
  - width IS NULL OR width > 0
  - height IS NULL OR height > 0
- **Indexes:**
  - one_primary_per_product (product_id) WHERE is_primary — partial unique; at most one primary per product
  - idx_product_images_product (product_id, position)
  - idx_product_images_variant (variant_id) WHERE variant_id IS NOT NULL
- **RLS Enabled:** Yes
  - `catalog_product_images_read`: SELECT using TRUE
  - `catalog_product_images_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: bundle_images**
- **Created in:** 002_catalog_images.sql
- **Purpose:** Renditions of bundle images. Same structure as product_images.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `bundle_id` BIGINT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE
  - `storage_prefix` TEXT NOT NULL
  - `alt` TEXT
  - `position` INT NOT NULL DEFAULT 0
  - `width` INT
  - `height` INT
  - `is_primary` BOOLEAN NOT NULL DEFAULT FALSE
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** bundle_id REFERENCES bundles(id) ON DELETE CASCADE
- **CHECK Constraints:** position >= 0; width/height > 0 if not NULL
- **Indexes:**
  - one_primary_per_bundle (bundle_id) WHERE is_primary
  - idx_bundle_images_bundle (bundle_id, position)
- **RLS Enabled:** Yes
  - `catalog_bundle_images_read`: SELECT using TRUE
  - `catalog_bundle_images_write`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

---

### Addresses & Orders

#### **Table: addresses**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Shipping/billing address repository. Multiple per user, one default. No edit after creation — soft immutability via RLS.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `user_id` UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `label` TEXT
  - `recipient_name` TEXT NOT NULL
  - `phone` TEXT NOT NULL
  - `street_line_1` TEXT NOT NULL
  - `street_line_2` TEXT
  - `city` TEXT NOT NULL
  - `region` TEXT
  - `postal_code` TEXT
  - `country_code` CHAR(2) NOT NULL
  - `is_default` BOOLEAN NOT NULL DEFAULT FALSE
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** user_id REFERENCES profiles(id) ON DELETE CASCADE
- **CHECK Constraints:** None
- **Indexes:** (implicit on id and user_id)
- **RLS Enabled:** Yes
  - `addresses_self`: ALL where user_id = auth.uid()
  - `addresses_admin_read`: SELECT where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: orders**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Order master. Tracks commerce transactions (retail, distributor signup/restock), payment status, sponsorship, totals breakdown, and payment provider references.
- **Modified by:** 019_payment_provider.sql (added PayHero columns: payhero_checkout_reference, payhero_external_reference, payhero_mpesa_receipt, provider), 020_processing_fee.sql (added processing_fee_minor), 021_pending_signup_unique.sql (added 'expired' enum value)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `order_number` TEXT NOT NULL UNIQUE (e.g., LL-2026-000123)
  - `user_id` UUID REFERENCES profiles(id) (nullable for guest checkout)
  - `customer_email` CITEXT NOT NULL
  - `customer_phone` TEXT
  - `kind` order_kind NOT NULL DEFAULT 'retail' (ENUM: retail | distributor_signup | distributor_restock)
  - `status` order_status NOT NULL DEFAULT 'pending' (ENUM: pending | paid | failed | cancelled | fulfilled | shipped | delivered | refunded | expired)
  - `subtotal_minor` BIGINT NOT NULL
  - `shipping_minor` BIGINT NOT NULL DEFAULT 0
  - `tax_minor` BIGINT NOT NULL DEFAULT 0
  - `discount_minor` BIGINT NOT NULL DEFAULT 0
  - `total_minor` BIGINT NOT NULL
  - `processing_fee_minor` BIGINT NOT NULL DEFAULT 0 (added in 020; payment provider fee)
  - `currency` CHAR(3) NOT NULL DEFAULT 'KES'
  - `sponsor_distributor_id` BIGINT REFERENCES distributors(id) (added in 001 as FK after distributors table created)
  - `shipping_address_id` BIGINT REFERENCES addresses(id)
  - `payment_provider` TEXT DEFAULT 'payhero' (changed from 'flutterwave' default in 019)
  - `payment_provider_ref` TEXT (Flutterwave transaction id)
  - `payhero_checkout_reference` TEXT (added in 019)
  - `payhero_external_reference` TEXT (added in 019)
  - `payhero_mpesa_receipt` TEXT (added in 019)
  - `paid_at` TIMESTAMPTZ
  - `notes` TEXT
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:**
  - user_id REFERENCES profiles(id) (no ON DELETE; defaults to RESTRICT for non-guest orders)
  - sponsor_distributor_id REFERENCES distributors(id) (deferred FK added in 001)
  - shipping_address_id REFERENCES addresses(id)
- **CHECK Constraints:** total_minor >= 0
- **Indexes:**
  - idx_orders_user_created (user_id, created_at DESC)
  - idx_orders_status_created (status, created_at DESC)
  - idx_orders_sponsor (sponsor_distributor_id) WHERE sponsor_distributor_id IS NOT NULL
  - idx_orders_payment_ref (payment_provider_ref) WHERE payment_provider_ref IS NOT NULL
  - idx_orders_payhero_checkout_ref (payhero_checkout_reference) WHERE payhero_checkout_reference IS NOT NULL (added in 019)
  - idx_orders_payhero_external_ref (payhero_external_reference) WHERE payhero_external_reference IS NOT NULL (added in 019)
  - idx_orders_one_pending_signup_per_user (user_id) WHERE status = 'pending' AND kind = 'distributor_signup' (added in 021; prevents duplicate pending signup orders)
  - idx_orders_one_pending_retail_per_user (user_id) WHERE status = 'pending' AND kind = 'retail' (added in 021; prevents duplicate pending retail orders)
- **RLS Enabled:** Yes
  - `orders_self_read`: SELECT where user_id = auth.uid()
  - `orders_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** trg_orders_updated_at (BEFORE UPDATE) → set_updated_at()

#### **Table: order_items**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Line items on an order. Each row is either a variant or a bundle; not both. Commission basis and PV computation tracked per line.
- **Modified by:** 014_comp_plan_v2_pv.sql (added commission_pv)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `order_id` BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE
  - `variant_id` BIGINT REFERENCES product_variants(id)
  - `bundle_id` BIGINT REFERENCES bundles(id)
  - `quantity` INT NOT NULL (CHECK > 0)
  - `unit_price_minor` BIGINT NOT NULL
  - `line_total_minor` BIGINT NOT NULL
  - `is_commissionable` BOOLEAN NOT NULL DEFAULT TRUE
  - `commissionable_amount_minor` BIGINT NOT NULL DEFAULT 0 (distributor price × quantity; basis for commission math)
  - `commission_pv` INT NOT NULL DEFAULT 0 (added in 014; total PV for this line for commission calculation)
- **Primary Key:** id
- **Foreign Keys:**
  - order_id REFERENCES orders(id) ON DELETE CASCADE
  - variant_id REFERENCES product_variants(id)
  - bundle_id REFERENCES bundles(id)
- **CHECK Constraints:**
  - quantity > 0
  - one_item_type: (variant_id IS NOT NULL AND bundle_id IS NULL) OR (variant_id IS NULL AND bundle_id IS NOT NULL) — mutually exclusive
- **Indexes:** idx_order_items_order (order_id)
- **RLS Enabled:** Yes
  - `order_items_self_read`: SELECT where order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
  - `order_items_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

---

### Distributor / Compensation

#### **Table: distributors**
- **Created in:** 001_initial_schema.sql
- **Purpose:** MLM participant record. Links user identity, upline (sponsor), tree insertion, KYC status, payout MSISDN (M-Pesa), current rank, and startup metadata.
- **Modified by:** 010_msisdn_change.sql (added payout_msisdn_pending, payout_msisdn_pending_at columns and index for pending verification queue)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `user_id` UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE
  - `sponsor_code` TEXT NOT NULL UNIQUE (e.g., LL-AB-7Q3K)
  - `sponsor_id` BIGINT REFERENCES distributors(id) (direct upline)
  - `joined_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `is_active` BOOLEAN NOT NULL DEFAULT TRUE
  - `starter_package_id` BIGINT REFERENCES bundles(id)
  - `starter_paid_at` TIMESTAMPTZ
  - `current_rank_id` BIGINT REFERENCES config_ranks(id) (deferred FK added in 001)
  - `current_rank_achieved_at` TIMESTAMPTZ
  - `payout_msisdn` TEXT (E.164 format, verified M-Pesa number)
  - `payout_msisdn_verified_at` TIMESTAMPTZ
  - `payout_msisdn_pending` TEXT (added in 010; new unverified number awaiting admin approval)
  - `payout_msisdn_pending_at` TIMESTAMPTZ (added in 010; timestamp when new number submitted)
  - `kyc_status` TEXT NOT NULL DEFAULT 'pending' (pending | approved | rejected)
  - `kyc_approved_at` TIMESTAMPTZ
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:**
  - user_id REFERENCES profiles(id) ON DELETE CASCADE
  - sponsor_id REFERENCES distributors(id)
  - starter_package_id REFERENCES bundles(id)
  - current_rank_id REFERENCES config_ranks(id) (deferred FK added in 001)
- **CHECK Constraints:** None
- **Indexes:**
  - idx_distributors_sponsor (sponsor_id)
  - idx_distributors_active (is_active) WHERE is_active = TRUE
  - idx_distributors_rank (current_rank_id)
  - idx_distributors_msisdn_pending (payout_msisdn_pending_at DESC) WHERE payout_msisdn_pending IS NOT NULL (added in 010; find pending verifications)
- **RLS Enabled:** Yes
  - `distributors_self_read`: SELECT where user_id = auth.uid()
  - `distributors_self_update`: UPDATE where user_id = auth.uid()
  - `distributors_downline_read`: SELECT where id IN (SELECT descendant_id FROM distributor_tree WHERE ancestor_id = (SELECT id FROM distributors WHERE user_id = auth.uid()))
  - `distributors_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** trg_distributors_updated_at (BEFORE UPDATE) → set_updated_at()

#### **Table: distributor_tree**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Closure table for the MLM hierarchy. One row per (ancestor, descendant) pair with depth 0..14. Enables O(1) ancestor/descendant lookups without recursive CTEs.
- **Modified by:** 012_closure_table_extension.sql (lifted depth cap from 7 to 14)
- **Columns:**
  - `ancestor_id` BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE
  - `descendant_id` BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE
  - `depth` INT NOT NULL (CHECK BETWEEN 0 AND 14)
- **Primary Key:** (ancestor_id, descendant_id)
- **Foreign Keys:**
  - ancestor_id REFERENCES distributors(id) ON DELETE CASCADE
  - descendant_id REFERENCES distributors(id) ON DELETE CASCADE
- **CHECK Constraints:** depth BETWEEN 0 AND 14
- **Indexes:**
  - idx_tree_descendant_depth (descendant_id, depth) — find all ancestors of a node at a specific depth
  - idx_tree_ancestor_depth (ancestor_id, depth) — find all descendants of a node at a specific depth
- **RLS Enabled:** Yes
  - `tree_self_read`: SELECT where ancestor_id = (SELECT id FROM distributors WHERE user_id = auth.uid()) OR descendant_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `tree_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: commission_ledger**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Per-order fan-out of commissions. Immutable once written; one row per (order, level, recipient) tuple. Records earned commissions for each upline level.
- **Modified by:** 014_comp_plan_v2_pv.sql (added basis_pv column to record PV separately from commission_basis_minor)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id) (commission recipient)
  - `source_order_id` BIGINT NOT NULL REFERENCES orders(id) (the order that triggered the commission)
  - `source_distributor_id` BIGINT NOT NULL REFERENCES distributors(id) (the order sponsor)
  - `level` INT NOT NULL (CHECK BETWEEN 1 AND 7)
  - `commission_basis_minor` BIGINT NOT NULL (KES amount base for rate application; kept for audit even after PV transition)
  - `basis_pv` INT NOT NULL DEFAULT 0 (added in 014; PV that produced this commission)
  - `rate_basis_points` INT NOT NULL (e.g., 2000 = 20%)
  - `amount_minor` BIGINT NOT NULL (CHECK >= 0; calculated amount)
  - `currency` CHAR(3) NOT NULL DEFAULT 'KES'
  - `config_commission_rate_id` BIGINT NOT NULL REFERENCES config_commission_rates(id) (rate snapshot for audit)
  - `earned_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `payout_id` BIGINT REFERENCES payouts(id) (deferred FK added in 001; null until paid)
- **Primary Key:** id
- **Foreign Keys:**
  - distributor_id REFERENCES distributors(id)
  - source_order_id REFERENCES orders(id)
  - source_distributor_id REFERENCES distributors(id)
  - config_commission_rate_id REFERENCES config_commission_rates(id)
  - payout_id REFERENCES payouts(id) (deferred FK added in 001)
- **CHECK Constraints:**
  - level BETWEEN 1 AND 7
  - amount_minor >= 0
- **Indexes:**
  - idx_commission_distributor_earned (distributor_id, earned_at DESC)
  - idx_commission_unpaid (distributor_id) WHERE payout_id IS NULL — find unpaid rows for a distributor
  - idx_commission_source_order (source_order_id) — idempotency check in write_commission_ledger
- **RLS Enabled:** Yes
  - `commission_self_read`: SELECT where distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `commission_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: monthly_salaries**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Monthly compensation summary. Computed once per distributor per calendar month; locked once attached to a payout.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id)
  - `period_year` INT NOT NULL
  - `period_month` INT NOT NULL (CHECK BETWEEN 1 AND 12)
  - `rank_at_period_id` BIGINT NOT NULL REFERENCES config_ranks(id) (rank snapshot for audit)
  - `personal_bottles_sold` INT NOT NULL DEFAULT 0
  - `team_gsv_minor` BIGINT NOT NULL DEFAULT 0
  - `qualified` BOOLEAN NOT NULL (meets threshold criteria)
  - `fixed_salary_minor` BIGINT NOT NULL DEFAULT 0
  - `performance_bonus_minor` BIGINT NOT NULL DEFAULT 0
  - `total_minor` BIGINT NOT NULL DEFAULT 0
  - `computed_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `payout_id` BIGINT REFERENCES payouts(id) (deferred FK added in 001; null until paid)
- **Primary Key:** id
- **Foreign Keys:**
  - distributor_id REFERENCES distributors(id)
  - rank_at_period_id REFERENCES config_ranks(id)
  - payout_id REFERENCES payouts(id) (deferred FK added in 001)
- **CHECK Constraints:** UNIQUE (distributor_id, period_year, period_month)
- **Indexes:** (implicit on UNIQUE constraint)
- **RLS Enabled:** Yes
  - `salary_self_read`: SELECT where distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `salary_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: rank_up_bonuses**
- **Created in:** 001_initial_schema.sql
- **Purpose:** One-time rank-up incentive. One row per distributor per rank; bonus issued exactly once even if compute_monthly_salary/detect_rank_up re-runs.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id)
  - `rank_id` BIGINT NOT NULL REFERENCES config_ranks(id)
  - `amount_minor` BIGINT NOT NULL (CHECK >= 0)
  - `awarded_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `payout_id` BIGINT REFERENCES payouts(id) (deferred FK added in 001)
- **Primary Key:** id
- **Foreign Keys:**
  - distributor_id REFERENCES distributors(id)
  - rank_id REFERENCES config_ranks(id)
  - payout_id REFERENCES payouts(id) (deferred FK added in 001)
- **CHECK Constraints:**
  - amount_minor >= 0
  - UNIQUE (distributor_id, rank_id) — one bonus per rank per distributor ever
- **Indexes:** (implicit on UNIQUE constraint)
- **RLS Enabled:** Yes
  - `bonus_self_read`: SELECT where distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `bonus_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: gsv_snapshots**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Denormalized monthly GSV summary. One row per distributor per calendar month; computed once by the monthly close.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id)
  - `period_year` INT NOT NULL
  - `period_month` INT NOT NULL (CHECK BETWEEN 1 AND 12)
  - `personal_bottles_sold` INT NOT NULL DEFAULT 0 (variant-line quantity only)
  - `personal_sales_minor` BIGINT NOT NULL DEFAULT 0 (commissionable amount from sponsor's orders)
  - `team_gsv_minor` BIGINT NOT NULL DEFAULT 0 (commissionable amount from entire downline, all 7 levels)
  - `active_recruits_count` INT NOT NULL DEFAULT 0 (direct downline with a paid order this month)
  - `computed_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** distributor_id REFERENCES distributors(id)
- **CHECK Constraints:** UNIQUE (distributor_id, period_year, period_month)
- **Indexes:** (implicit on UNIQUE constraint)
- **RLS Enabled:** Yes
  - `gsv_self_read`: SELECT where distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `gsv_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

---

### Config Tables

#### **Table: config_commission_rates**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Versioned commission rate matrix. Rates are applied at order-payment time based on the active row for that level and date. Immutable once written; edits create new rows with new effective_from.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `level` INT NOT NULL (CHECK BETWEEN 1 AND 7)
  - `rate_basis_points` INT NOT NULL (CHECK >= 0; 2000 = 20%)
  - `effective_from` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `effective_until` TIMESTAMPTZ
  - `created_by` UUID REFERENCES profiles(id)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `notes` TEXT
- **Primary Key:** id
- **Foreign Keys:** created_by REFERENCES profiles(id)
- **CHECK Constraints:**
  - level BETWEEN 1 AND 7
  - rate_basis_points >= 0
  - effective_until IS NULL OR effective_until > effective_from
- **Indexes:**
  - idx_commission_rates_active (level, effective_from) WHERE effective_until IS NULL — active rate per level at a glance
- **RLS Enabled:** Yes
  - `config_rates_read`: SELECT where auth.uid() IS NOT NULL (all authenticated users)
  - `config_rates_super`: ALL where has_role('superadmin')
- **Triggers:** None

#### **Table: config_ranks**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Versioned rank definitions. One row per rank position per era. Includes thresholds, bonuses, and qualifying parameters.
- **Modified by:** 013_comp_plan_rewrite.sql (added min_personal_sales_minor, bumped rank_position CHECK to 1..8), 014_comp_plan_v2_pv.sql (added min_personal_pv, qualifying_months columns)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `rank_position` INT NOT NULL (CHECK BETWEEN 1 AND 8)
  - `rank_name` TEXT NOT NULL (e.g., "Team Builder", "President")
  - `emoji` TEXT
  - `min_active_recruits` INT NOT NULL DEFAULT 0
  - `min_group_sales_minor` BIGINT NOT NULL DEFAULT 0 (team KES target)
  - `min_personal_sales_minor` BIGINT NOT NULL DEFAULT 0 (added in 013; personal KES target, superseded by min_personal_pv in 014)
  - `min_personal_pv` INT NOT NULL DEFAULT 0 (added in 014; personal PV target; replaces min_personal_sales_minor)
  - `rank_up_bonus_minor` BIGINT NOT NULL DEFAULT 0
  - `qualifying_months` INT NOT NULL DEFAULT 1 (added in 014; consecutive months required to advance; Phase 8 will enforce this in detect_rank_up)
  - `effective_from` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `effective_until` TIMESTAMPTZ
  - `created_by` UUID REFERENCES profiles(id)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `notes` TEXT (added in 014)
- **Primary Key:** id
- **Foreign Keys:** created_by REFERENCES profiles(id)
- **CHECK Constraints:**
  - rank_position BETWEEN 1 AND 8
  - effective_until IS NULL OR effective_until > effective_from
- **Indexes:**
  - idx_ranks_active (rank_position, effective_from) WHERE effective_until IS NULL
- **RLS Enabled:** Yes
  - `config_ranks_read`: SELECT where auth.uid() IS NOT NULL
  - `config_ranks_super`: ALL where has_role('superadmin')
- **Triggers:** None

#### **Table: config_salary_tiers**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Versioned salary schedule. Salaries are KES fixed amounts + optional perf bonus on excess team GSV. Keyed by rank_position and effective dates.
- **Modified by:** 013_comp_plan_rewrite.sql (bumped rank_position CHECK to 1..8), 014_comp_plan_v2_pv.sql (no schema change, seed data updated)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `rank_position` INT NOT NULL (CHECK BETWEEN 1 AND 8)
  - `min_personal_bottles` INT NOT NULL DEFAULT 0 (unused in v2 plan; kept for backward compat)
  - `min_team_gsv_minor` BIGINT NOT NULL DEFAULT 0 (team KES threshold for qualification)
  - `fixed_salary_minor` BIGINT NOT NULL DEFAULT 0
  - `performance_bonus_basis_points` INT NOT NULL DEFAULT 0 (% of excess GSV; zero in v2 plan)
  - `effective_from` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `effective_until` TIMESTAMPTZ
  - `created_by` UUID REFERENCES profiles(id)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** created_by REFERENCES profiles(id)
- **CHECK Constraints:**
  - rank_position BETWEEN 1 AND 8
  - effective_until IS NULL OR effective_until > effective_from
- **Indexes:** (implicit on primary key)
- **RLS Enabled:** Yes
  - `config_salary_read`: SELECT where auth.uid() IS NOT NULL
  - `config_salary_super`: ALL where has_role('superadmin')
- **Triggers:** None

#### **Table: config_starter_packages**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Versioned starter package definitions (joining fee + bundle). Associates a package code with a bundle and a one-time fee that the signup route enforces.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `package_code` TEXT NOT NULL (e.g., 'A', 'B')
  - `bundle_id` BIGINT NOT NULL REFERENCES bundles(id)
  - `joining_fee_minor` BIGINT NOT NULL
  - `effective_from` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `effective_until` TIMESTAMPTZ
  - `created_by` UUID REFERENCES profiles(id)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:**
  - bundle_id REFERENCES bundles(id)
  - created_by REFERENCES profiles(id)
- **CHECK Constraints:**
  - effective_until IS NULL OR effective_until > effective_from
- **Indexes:** (implicit on primary key)
- **RLS Enabled:** Yes
  - `config_starter_read`: SELECT where auth.uid() IS NOT NULL
  - `config_starter_super`: ALL where has_role('superadmin')
- **Triggers:** None

#### **Table: config_settings**
- **Created in:** 009_commission_compression.sql
- **Purpose:** Runtime feature flags and policy overrides. Key/value pairs; seed example: commission_compression_enabled.
- **Modified by:** None
- **Columns:**
  - `key` TEXT PRIMARY KEY
  - `value` JSONB NOT NULL
  - `notes` TEXT
  - `updated_by` UUID REFERENCES profiles(id)
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** key
- **Foreign Keys:** updated_by REFERENCES profiles(id)
- **CHECK Constraints:** None
- **Indexes:** (implicit on primary key)
- **RLS Enabled:** Yes
  - `config_settings_read`: SELECT where auth.uid() IS NOT NULL
  - `config_settings_super`: ALL where has_role('superadmin')
- **Triggers:** None

---

### Payments & Payouts

#### **Table: payouts**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Monthly payout summary. One row per distributor per calendar month. Aggregates commissions, salary, bonuses, and retail profit; tracks provider and status.
- **Modified by:** 019_payment_provider.sql (added provider, payhero_transfer_reference, payhero_mpesa_receipt)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id)
  - `period_year` INT NOT NULL
  - `period_month` INT NOT NULL
  - `commissions_total_minor` BIGINT NOT NULL DEFAULT 0
  - `salary_total_minor` BIGINT NOT NULL DEFAULT 0
  - `rank_bonus_total_minor` BIGINT NOT NULL DEFAULT 0
  - `retail_profit_minor` BIGINT NOT NULL DEFAULT 0
  - `gross_total_minor` BIGINT NOT NULL
  - `fees_minor` BIGINT NOT NULL DEFAULT 0
  - `net_total_minor` BIGINT NOT NULL (amount disbursed/to-be-disbursed after deductions)
  - `currency` CHAR(3) NOT NULL DEFAULT 'KES'
  - `payout_method` TEXT NOT NULL DEFAULT 'mpesa' (mpesa | bank_transfer | card)
  - `payout_msisdn` TEXT (M-Pesa number)
  - `status` payout_status NOT NULL DEFAULT 'pending' (ENUM: pending | processing | completed | failed | reversed)
  - `provider` TEXT NOT NULL DEFAULT 'payhero' (added in 019; flutterwave | payhero)
  - `flutterwave_transfer_id` TEXT (Flutterwave ref, kept for historical data)
  - `payhero_transfer_reference` TEXT (added in 019)
  - `payhero_mpesa_receipt` TEXT (added in 019)
  - `initiated_at` TIMESTAMPTZ
  - `completed_at` TIMESTAMPTZ
  - `failure_reason` TEXT
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** distributor_id REFERENCES distributors(id)
- **CHECK Constraints:** UNIQUE (distributor_id, period_year, period_month)
- **Indexes:**
  - idx_payouts_status (status, created_at DESC) — find pending/processing payouts
  - idx_payouts_distributor_period (distributor_id, period_year DESC, period_month DESC) — distributor's payout history
- **RLS Enabled:** Yes
  - `payout_self_read`: SELECT where distributor_id = (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `payout_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: clawback_resolutions**
- **Created in:** 011_clawback_resolutions.sql
- **Purpose:** Workflow for refunded orders with paid commissions. Tracks resolution decision (written_off or deducted_from_payout) and associated payout.
- **Modified by:** 017_apply_clawback_deduction.sql (added applied_at column)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `order_id` BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE
  - `paid_amount_minor` BIGINT NOT NULL (CHECK >= 0)
  - `paid_count` INT NOT NULL (CHECK >= 0)
  - `resolution` TEXT (written_off | deducted_from_payout)
  - `deducted_from_payout_id` BIGINT REFERENCES payouts(id) (the payout to net the amount from)
  - `applied_at` TIMESTAMPTZ (added in 017; when the deduction was applied)
  - `notes` TEXT
  - `resolved_by` UUID REFERENCES profiles(id) (admin who made the decision)
  - `resolved_at` TIMESTAMPTZ
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:**
  - order_id REFERENCES orders(id) ON DELETE CASCADE
  - deducted_from_payout_id REFERENCES payouts(id)
  - resolved_by REFERENCES profiles(id)
- **CHECK Constraints:**
  - paid_amount_minor >= 0
  - paid_count >= 0
  - UNIQUE (order_id)
  - resolution IS NULL OR resolution IN ('written_off', 'deducted_from_payout')
  - (deducted_from_payout_id IS NULL) OR (resolution = 'deducted_from_payout')
  - (resolution IS NULL AND resolved_at IS NULL) OR (resolution IS NOT NULL AND resolved_at IS NOT NULL)
- **Indexes:**
  - idx_clawback_pending (created_at DESC) WHERE resolution IS NULL — find unresolved clawbacks
- **RLS Enabled:** Yes
  - `clawback_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: manual_ledger_adjustments**
- **Created in:** 018_manual_ledger_adjustments.sql
- **Purpose:** Admin-driven manual commission adjustments (goodwill credits, corrections, clawback refunds). Included in payout drafts alongside commission_ledger.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE
  - `amount_minor` BIGINT NOT NULL (signed: positive = credit, negative = debit)
  - `currency` CHAR(3) NOT NULL DEFAULT 'KES'
  - `period_year` INT NOT NULL
  - `period_month` INT NOT NULL (CHECK BETWEEN 1 AND 12)
  - `reason` TEXT NOT NULL (CHECK length >= 3)
  - `actor_id` UUID REFERENCES profiles(id) (admin who made the adjustment)
  - `payout_id` BIGINT REFERENCES payouts(id) (null until paid)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:**
  - distributor_id REFERENCES distributors(id) ON DELETE CASCADE
  - actor_id REFERENCES profiles(id)
  - payout_id REFERENCES payouts(id)
- **CHECK Constraints:** period_month BETWEEN 1 AND 12; length(reason) >= 3
- **Indexes:**
  - idx_mla_distributor_period (distributor_id, period_year, period_month)
  - idx_mla_unpaid (distributor_id) WHERE payout_id IS NULL — unpaid adjustments for a distributor
- **RLS Enabled:** Yes
  - `mla_self_read`: SELECT where distributor_id IN (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `mla_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: webhook_deliveries**
- **Created in:** 019_payment_provider.sql
- **Purpose:** Idempotency table for incoming webhooks. Dedup key is (provider, event_id). Records which provider events we've seen and processed.
- **Modified by:** 022_webhook_deliveries_event_type.sql (added event_type and error columns to match 019 spec after a schema drift)
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `provider` TEXT NOT NULL (flutterwave | payhero)
  - `event_id` TEXT NOT NULL
  - `event_type` TEXT (added in 022; e.g., 'order.paid', 'transfer.succeeded')
  - `signature_ok` BOOLEAN NOT NULL (webhook signature verified?)
  - `received_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `processed_at` TIMESTAMPTZ (when the event handler completed)
  - `body` JSONB NOT NULL (full webhook payload)
  - `error` TEXT (added in 022; error message if processing failed)
- **Primary Key:** id
- **Foreign Keys:** None
- **CHECK Constraints:** UNIQUE (provider, event_id)
- **Indexes:**
  - idx_webhook_deliveries_received (received_at DESC)
  - idx_webhook_deliveries_provider_received (provider, received_at DESC)
- **RLS Enabled:** Yes
  - `webhook_deliveries_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

#### **Table: payment_attempts**
- **Created in:** 019_payment_provider.sql
- **Purpose:** Audit trail of payment provider API calls. One row per attempt (init, verify, refund, etc.). For support debugging.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `order_id` BIGINT REFERENCES orders(id) ON DELETE CASCADE
  - `provider` TEXT NOT NULL (flutterwave | payhero)
  - `attempt_type` TEXT NOT NULL (stk_push | b2c_transfer | verify | refund | etc.)
  - `request_payload` JSONB
  - `response_payload` JSONB
  - `http_status` INT (HTTP status code from provider)
  - `status` TEXT NOT NULL (initiated | success | failed | error)
  - `error_message` TEXT
  - `attempted_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** order_id REFERENCES orders(id) ON DELETE CASCADE
- **CHECK Constraints:** None
- **Indexes:**
  - idx_payment_attempts_order (order_id, attempted_at DESC)
  - idx_payment_attempts_provider_attempted (provider, attempted_at DESC)
- **RLS Enabled:** Yes
  - `payment_attempts_admin`: ALL where has_role('admin') OR has_role('superadmin')
  - `payment_attempts_self_read`: SELECT where order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
- **Triggers:** None

---

### System

#### **Table: audit_log**
- **Created in:** 001_initial_schema.sql
- **Purpose:** Mandatory audit trail for sensitive actions (config edits, payout state changes, distributor provisioning, clawbacks, manual adjustments).
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `actor_id` UUID REFERENCES profiles(id) (null for service-role / webhook actions)
  - `action` TEXT NOT NULL (e.g., 'config_commission_rate.update', 'order.mark_paid')
  - `resource_type` TEXT NOT NULL (e.g., 'config_commission_rates', 'orders', 'payouts')
  - `resource_id` TEXT
  - `before_data` JSONB
  - `after_data` JSONB
  - `ip_address` INET
  - `user_agent` TEXT
  - `occurred_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** actor_id REFERENCES profiles(id)
- **CHECK Constraints:** None
- **Indexes:**
  - idx_audit_actor_time (actor_id, occurred_at DESC) — all actions by a user
  - idx_audit_resource (resource_type, resource_id) — all actions on a resource
- **RLS Enabled:** Yes
  - `audit_super_read`: SELECT where has_role('superadmin')
  - `audit_insert_system`: INSERT WITH CHECK (true) — service role + RPCs can insert
- **Triggers:** None

#### **Table: msisdn_verifications**
- **Created in:** 016_msisdn_verifications.sql
- **Purpose:** SMS OTP verification flow for MSISDN (M-Pesa) changes. One-time code with TTL; tracks attempts to prevent brute-force.
- **Modified by:** None
- **Columns:**
  - `id` BIGSERIAL PRIMARY KEY
  - `distributor_id` BIGINT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE
  - `msisdn` TEXT NOT NULL
  - `code_hash` TEXT NOT NULL (SHA-256 of 6-digit code)
  - `expires_at` TIMESTAMPTZ NOT NULL (15-minute TTL typical)
  - `used_at` TIMESTAMPTZ (null = active; set when code is matched)
  - `attempts` INT NOT NULL DEFAULT 0 (CHECK >= 0; brute-force guard)
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- **Primary Key:** id
- **Foreign Keys:** distributor_id REFERENCES distributors(id) ON DELETE CASCADE
- **CHECK Constraints:** attempts >= 0
- **Indexes:**
  - uq_msisdn_verifications_active (distributor_id) WHERE used_at IS NULL — only one active code per distributor
  - idx_msisdn_verifications_expires_at (expires_at) — find expired codes for cleanup
- **RLS Enabled:** Yes
  - `msisdn_verifications_self_read`: SELECT where distributor_id IN (SELECT id FROM distributors WHERE user_id = auth.uid())
  - `msisdn_verifications_admin`: ALL where has_role('admin') OR has_role('superadmin')
- **Triggers:** None

---

## Schema-Wide Observations

### Enums

- **user_role** (001): ENUM with values: customer | distributor | admin | superadmin
- **order_status** (001, modified 021): ENUM with values: pending | paid | failed | cancelled | fulfilled | shipped | delivered | refunded | expired (expired added in 021)
- **order_kind** (001): ENUM with values: retail | distributor_signup | distributor_restock
- **payout_status** (001): ENUM with values: pending | processing | completed | failed | reversed

### Custom RPCs / Functions

#### Helpers (non-payment)

- **public.set_updated_at()** (001, TRIGGER): LANGUAGE plpgsql. Bumps updated_at on row update. Used on profiles, products, orders, distributors. SECURITY DEFINER.

- **public.has_role(target_role user_role)** (001, RETURNS BOOLEAN): LANGUAGE plpgsql STABLE SECURITY DEFINER. Checks if auth.uid() has an active (revoked_at IS NULL) user_roles row for the given role. Used throughout RLS policies.

- **public.add_distributor_to_tree(p_new_distributor_id BIGINT, p_parent_distributor_id BIGINT)** (001, modified 012): LANGUAGE plpgsql SECURITY DEFINER. Inserts self-row at depth 0 and inherited ancestors from parent up to depth 14 (lifted from 7 in 012). Idempotent (ON CONFLICT in 012).

- **public.generate_sponsor_code()** (001): LANGUAGE plpgsql. Returns 8-char sponsor code (LL-XX-XXXX). Non-cryptographic.

- **public.generate_order_number()** (003): LANGUAGE plpgsql. Returns LL-YYYY-NNNNNN where NNNNNN is from order_number_seq.

- **public.rebuild_distributor_tree_for(p_distributor_id BIGINT)** (012): LANGUAGE plpgsql SECURITY DEFINER. Backfill helper. Walks up sponsor_id, reconstructing/refreshing tree rows to depth 14. Returns count of ancestor rows touched.

- **public.get_setting_bool(p_key TEXT, p_default BOOLEAN)** (009): LANGUAGE plpgsql STABLE. Reads config_settings.value, parses JSON boolean, returns default on miss/error.

- **public.default_sponsor_code()** (021): LANGUAGE sql STABLE SECURITY DEFINER. Returns the founder's (sponsor_id IS NULL) sponsor_code for SEO/orphan attribution. Callable by anon + authenticated.

#### Commission & Compensation RPCs (SECURITY DEFINER; all service_role only)

- **public.write_commission_ledger(p_order_id BIGINT)** (004, modified 009 for compression, 012 for depth-14 chain, 013 for maintenance + rank gating, 014 for PV-based): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS INT (rows written). Idempotent (checks source_order_id for duplicates). Walks distributor_tree from sponsor, fans out commissions 1..7 levels. Honors compression flag, rank gate (recipient earns levels 1..rank_position only), and maintenance check (recipient must hit personal PV target for month). Inserts commission_ledger rows; rate applied to basis_pv (PV-based in 014).

- **public.compute_gsv_snapshot(p_distributor_id BIGINT, p_year INT, p_month INT)** (006): LANGUAGE plpgsql SECURITY DEFINER. RETURNS BIGINT (gsv_snapshots.id). Upserts denormalized monthly totals (personal bottles, personal sales, team GSV, active recruits).

- **public.compute_monthly_salary(p_distributor_id BIGINT, p_year INT, p_month INT)** (006): LANGUAGE plpgsql SECURITY DEFINER. RETURNS BIGINT. Upserts monthly_salaries. Locked once attached to payout.

- **public.detect_rank_up(p_distributor_id BIGINT, p_year INT, p_month INT)** (006, modified 013 to treat NULL current_rank_id as position 0, 015 for sequential + streak gating): LANGUAGE plpgsql SECURITY DEFINER. RETURNS INT (new rank_position) or NULL. Optionally promotes distributor if qualified. Sequential: only considers target = current + 1. Streak-gated (015): if target.qualifying_months > 1, must have N consecutive qualifying months ending at the current month.

- **public.is_distributor_maintained(p_distributor_id BIGINT, p_year INT, p_month INT)** (013, modified 014 for PV): LANGUAGE plpgsql STABLE SECURITY DEFINER. RETURNS BOOLEAN. Checks if distributor's personal PV (order total_minor summed) in the given month >= current rank's min_personal_pv. Newbie falls back to rank-1 threshold.

- **public.is_distributor_qualified_for_rank(p_distributor_id BIGINT, p_rank_id BIGINT, p_year INT, p_month INT)** (015): LANGUAGE plpgsql STABLE SECURITY DEFINER. RETURNS BOOLEAN. One-month qualifier for a target rank: maintained + team_gsv ≥ rank.min_group_sales_minor + active_recruits ≥ rank.min_active_recruits.

- **public.count_qualifying_streak(p_distributor_id BIGINT, p_target_rank_id BIGINT, p_ending_year INT, p_ending_month INT, p_max INT)** (015): LANGUAGE plpgsql STABLE SECURITY DEFINER. RETURNS INT. Walks backward from (ending_year, ending_month) counting consecutive months qualifying for target rank. Capped at p_max iterations.

#### Order Payment & Inventory RPCs (SECURITY DEFINER; all service_role only)

- **public.mark_order_paid(p_order_id BIGINT, p_provider_ref TEXT, p_paid_at TIMESTAMPTZ DEFAULT NOW())** (003): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS BOOLEAN. Idempotent status flip (pending → paid) with inventory decrement. Decrements product_variants.inventory_qty for direct and bundle-expanded lines; raises if inventory underflows (CHECK constraint). Inserts audit_log row. Returns TRUE if transition happened, FALSE if already non-pending.

- **public.restore_order_inventory(p_order_id BIGINT)** (007): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS BOOLEAN. Mirrors mark_order_paid inventory decrement as an increment (refund). Allowed for paid|fulfilled|shipped; raises for delivered or refunded. Inserts audit_log.

- **public.provision_distributor(p_order_id BIGINT)** (005): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS BIGINT (distributors.id). Converts paid distributor_signup order into distributor row + tree insertion + role grant. Idempotent: returns existing distributor row if user already has one. Refuses if order is missing sponsor or sponsor is inactive (invite-only guard).

#### Refund & Reconciliation RPCs (SECURITY DEFINER; all service_role only)

- **public.void_unpaid_commissions_for_order(p_order_id BIGINT)** (008): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS JSONB. When order is refunded, DELETEs unpaid commission_ledger rows for that order; reports (count, amount) of already-paid rows so admin can reconcile manually.

- **public.apply_clawback_deduction(p_resolution_id BIGINT)** (017): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS BOOLEAN. Applies a resolved clawback to a payout, reducing net_total_minor. Idempotent: returns FALSE if already applied. Enforces payout status guards (refuses if completed). Inserts audit_log.

#### Webhook Delivery RPCs (SECURITY DEFINER; service_role only)

- **public.record_webhook_delivery(p_provider TEXT, p_event_id TEXT, p_event_type TEXT, p_signature_ok BOOLEAN, p_body JSONB)** (019): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS BOOLEAN. Idempotency gate (ON CONFLICT DO NOTHING). Returns TRUE if first time seeing this (provider, event_id), FALSE if duplicate. Inserts webhook_deliveries row.

- **public.mark_webhook_processed(p_provider TEXT, p_event_id TEXT, p_error TEXT DEFAULT NULL)** (019): LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp. RETURNS VOID. Updates webhook_deliveries.processed_at + error after handler completes (success or failure).

### Known Schema Drifts

- **webhook_deliveries (migration 022 drift)**: Migration 019 in this repo specifies event_type and error columns, but the live production DB schema (created from an earlier draft of 019 before those columns existed) was missing them. This caused PayHero webhook handler to fail with "column does not exist" (42703) when attempting to INSERT. Migration 022 backfills the missing columns. Symptom: orders paid via M-Pesa never flipped to 'paid' status on 2026-05-18 during first post-deploy test.

- **order_status enum (migration 021)**: The 'expired' value was added in migration 021 to mark abandoned pending orders (checkout init timeout > 15 minutes). Migration 021_pending_signup_unique backfilled existing duplicate pending orders to 'cancelled' (using the pre-21 enum value) to allow the unique indexes to be created. After that, migration 022 (renamed 022_eight_ranks in the file listing) was already applied, then migration 021_pending_signup_unique was applied, then finally 022_webhook_deliveries_event_type. The order reflects how they were sequenced in development to resolve conflicts.

---

## Migration Timeline Summary

| # | Name | Change Summary |
|---|------|---|
| 001 | initial_schema.sql | Core schema: profiles, user_roles, catalog (categories, products, variants, bundles, images), orders, order_items, addresses, distributors, distributor_tree (depth 0-7), commission_ledger, monthly_salaries, rank_up_bonuses, payouts, gsv_snapshots, config tables (ranks, rates, salaries, starter packages), audit_log. RLS enabled on all tables. Seed 7-rank comp plan from PDF. |
| 002 | catalog_images.sql | Add product_images, bundle_images tables. Provision 'catalog' storage bucket. RLS policies for read-all, write-admin. |
| 003 | orders_rpc.sql | Add order_number_seq, generate_order_number() RPC. Add mark_order_paid(order_id, provider_ref, paid_at) RPC — atomically flip to 'paid', decrement inventory (direct + bundle-expanded), audit log. Idempotent. |
| 004 | commission_ledger.sql | Add write_commission_ledger(order_id) RPC — fan out commissions 1..7 levels from sponsor, apply rates effective at paid_at, use closure table for O(1) lookup. Idempotent on source_order_id. |
| 005 | provision_distributor.sql | Add provision_distributor(order_id) RPC — converts paid distributor_signup order to distributors row, tree insertion, role grant. Idempotent; invite-only guard (sponsor must exist + be active). |
| 006 | monthly_close.sql | Add three RPCs for monthly close: compute_gsv_snapshot (denormalize period totals), compute_monthly_salary (calculate fixed + perf bonus, locked once in payout), detect_rank_up (promote + insert rank bonus if qualified). All idempotent; rows locked once attached to payout. |
| 007 | refund_inventory.sql | Add restore_order_inventory(order_id) RPC — mirror of mark_order_paid decrement, used on refund. Allowed for paid/fulfilled/shipped only. |
| 008 | commission_clawback.sql | Add void_unpaid_commissions_for_order(order_id) RPC — delete unpaid commission_ledger rows on refund, report already-paid rows for manual reconciliation. Idempotent. |
| 009 | commission_compression.sql | Add config_settings table + RLS. Add get_setting_bool() helper. Seed commission_compression_enabled=false. Replace write_commission_ledger v1 with v2 that honours compression flag (skip inactive ancestors, promote next active to fill level slot). |
| 010 | msisdn_change.sql | Add payout_msisdn_pending, payout_msisdn_pending_at columns to distributors. Add partial index on pending_at for verification queue visibility. |
| 011 | clawback_resolutions.sql | Add clawback_resolutions table — tracks resolution (written_off or deducted_from_payout) + associated payout for refunded orders with already-paid commissions. Admin-driven workflow. RLS admin-only. |
| 012 | closure_table_extension.sql | Lift distributor_tree.depth CHECK from 0-7 to 0-14. Update add_distributor_to_tree() + seed backfill rebuild_distributor_tree_for() to depth 14. Update write_commission_ledger v2 to use depth 0-13 in compressed mode (14 visible levels to skip inactives). |
| 013 | comp_plan_rewrite.sql | Replace 7-rank scheme with 8-rank model (Team Builder → President). Add min_personal_sales_minor, bump rank_position CHECK to 1..8. Close out old config rows; reset distributors.current_rank_id to NULL (Newbie). Add is_distributor_maintained(distributor, year, month) helper (personal KES ≥ rank threshold). Update write_commission_ledger v3 with rank gate (level ≤ rank_position) + maintenance gate. Update detect_rank_up to treat NULL as position 0. |
| 014 | comp_plan_v2_pv.sql | Replace KES-amount commissions with PV-based. Add pv_per_bottle, selling_price_minor, commission_pv columns. Backfill standard variants (30ml=550 PV, 50ml=950 PV). Close out 013 config rows. Seed 8 new ranks + commission rates (L1 20% / L7 0.5%, total 40%). Update is_distributor_maintained() to sum PV instead of KES. Update write_commission_ledger v4 to read basis_pv, apply rate as basis_pv * rate_bp / 100. Backfill commission_pv on existing order_items. |
| 015 | qualifying_streak.sql | Add is_distributor_qualified_for_rank(distributor, rank, year, month), count_qualifying_streak(distributor, rank, ending_year, ending_month, max). Update detect_rank_up v2 to sequential (only target = current+1) + streak-gated (if qualifying_months > 1, need N consecutive months). |
| 016 | msisdn_verifications.sql | Add msisdn_verifications table — one-time code (SHA-256 hashed), TTL, attempt counter. Partial unique index on distributor_id WHERE used_at IS NULL (one active code per distributor). RLS self-read + admin. |
| 017 | apply_clawback_deduction.sql | Add applied_at column to clawback_resolutions. Add apply_clawback_deduction(resolution_id) RPC — net the amount from the referenced payout's net_total_minor, floor at 0. Idempotent; refuses if payout already completed. |
| 018 | manual_ledger_adjustments.sql | Add manual_ledger_adjustments table — admin-created, signed adjustments (credit/debit) included in payout drafts. No order FK (not per-order). RLS self-read + admin. |
| 019 | payment_provider.sql | Add PayHero alongside Flutterwave. Add columns to orders (payhero_checkout_reference, payhero_external_reference, payhero_mpesa_receipt). Add columns to payouts (provider, payhero_transfer_reference, payhero_mpesa_receipt). Create webhook_deliveries table (dedup key: provider, event_id). Create payment_attempts table (audit trail). Add record_webhook_delivery() + mark_webhook_processed() RPCs. |
| 020 | processing_fee.sql | Add processing_fee_minor column to orders (payment provider fee passthrough). Defaults to 0 for pre-20 orders. |
| 021 | default_sponsor_rpc.sql | Add default_sponsor_code() RPC (STABLE, SECURITY DEFINER, callable by anon+authenticated) — returns founder's sponsor_code for SEO/orphan attribution. |
| 021 | pending_signup_unique.sql | (Out-of-order; applied after 022) Backfill pre-fix duplicate pending orders to 'cancelled'. Add 'expired' to order_status enum (marks abandoned pending after 15-min reuse window). Create partial unique indexes: idx_orders_one_pending_signup_per_user, idx_orders_one_pending_retail_per_user. Closes PayHero double-STK-push bug. |
| 022 | eight_ranks.sql | Bump rank_position CHECK on config_ranks + config_salary_tiers from 1..7 to 1..8 (President rank support). |
| 022 | webhook_deliveries_event_type.sql | (Actually hotfix for schema drift) Backfill webhook_deliveries: add event_type, error columns. Reassert indexes + RLS policy. Unblocks PayHero webhook ingestion. |

---

**Total tables created:** 26 (profiles, user_roles, categories, products, product_variants, bundles, bundle_items, product_images, bundle_images, addresses, orders, order_items, distributors, distributor_tree, commission_ledger, monthly_salaries, rank_up_bonuses, payouts, gsv_snapshots, config_commission_rates, config_ranks, config_salary_tiers, config_starter_packages, config_settings, clawback_resolutions, manual_ledger_adjustments, webhook_deliveries, payment_attempts, msisdn_verifications, audit_log).

**Total custom functions:** 19 (set_updated_at, has_role, add_distributor_to_tree, generate_sponsor_code, generate_order_number, rebuild_distributor_tree_for, get_setting_bool, default_sponsor_code, write_commission_ledger [5 versions], compute_gsv_snapshot, compute_monthly_salary, detect_rank_up [2 versions], is_distributor_maintained [2 versions], is_distributor_qualified_for_rank, count_qualifying_streak, mark_order_paid, restore_order_inventory, provision_distributor, void_unpaid_commissions_for_order, apply_clawback_deduction, record_webhook_delivery, mark_webhook_processed).

**RLS:** Enabled on all 26 tables. Policies range from public-read-admin-write (catalog) to self-read + admin (personal data) to admin-only (ledgers, config, clawback, payment audit).

**Key design patterns:**
- Closure table for O(1) tree traversal (distributor_tree, depth 0–14)
- Versioned config tables (effective_from/effective_until) — immutable rows, edits create new versions
- Idempotent RPCs via dedup keys (source_order_id, provider+event_id, distributor+rank, distributor+period+month)
- Row-level security on everything; service_role-only RPCs for payment/commission writes
- Denominated currency in minor units (cents) to avoid float arithmetic
- Multi-era commission logic: KES-based (001–012) → PV-based (014+), with schema drift hotfix (022 webhook_deliveries)