export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country_code: string
          created_at: string
          id: number
          is_default: boolean
          label: string | null
          phone: string
          postal_code: string | null
          recipient_name: string
          region: string | null
          street_line_1: string
          street_line_2: string | null
          user_id: string
        }
        Insert: {
          city: string
          country_code: string
          created_at?: string
          id?: number
          is_default?: boolean
          label?: string | null
          phone: string
          postal_code?: string | null
          recipient_name: string
          region?: string | null
          street_line_1: string
          street_line_2?: string | null
          user_id: string
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          id?: number
          is_default?: boolean
          label?: string | null
          phone?: string
          postal_code?: string | null
          recipient_name?: string
          region?: string | null
          street_line_1?: string
          street_line_2?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          id: number
          ip_address: unknown
          occurred_at: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          id?: number
          ip_address?: unknown
          occurred_at?: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          id?: number
          ip_address?: unknown
          occurred_at?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_images: {
        Row: {
          alt: string | null
          bundle_id: number
          created_at: string
          height: number | null
          id: number
          is_primary: boolean
          position: number
          storage_prefix: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          bundle_id: number
          created_at?: string
          height?: number | null
          id?: number
          is_primary?: boolean
          position?: number
          storage_prefix: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          bundle_id?: number
          created_at?: string
          height?: number | null
          id?: number
          is_primary?: boolean
          position?: number
          storage_prefix?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_images_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: number
          id: number
          quantity: number
          variant_id: number
        }
        Insert: {
          bundle_id: number
          id?: number
          quantity: number
          variant_id: number
        }
        Update: {
          bundle_id?: number
          id?: number
          quantity?: number
          variant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          distributor_price_minor: string | number
          id: number
          is_active: boolean
          is_starter_package: boolean
          name: string
          retail_price_minor: string | number
          slug: string
          starter_package_code: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          distributor_price_minor: string | number
          id?: number
          is_active?: boolean
          is_starter_package?: boolean
          name: string
          retail_price_minor: string | number
          slug: string
          starter_package_code?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          distributor_price_minor?: string | number
          id?: number
          is_active?: boolean
          is_starter_package?: boolean
          name?: string
          retail_price_minor?: string | number
          slug?: string
          starter_package_code?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          parent_id: number | null
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
          parent_id?: number | null
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
          parent_id?: number | null
          position?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clawback_resolutions: {
        Row: {
          applied_at: string | null
          created_at: string
          deducted_from_payout_id: number | null
          id: number
          notes: string | null
          order_id: number
          paid_amount_minor: string | number
          paid_count: number
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          deducted_from_payout_id?: number | null
          id?: number
          notes?: string | null
          order_id: number
          paid_amount_minor: string | number
          paid_count: number
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          deducted_from_payout_id?: number | null
          id?: number
          notes?: string | null
          order_id?: number
          paid_amount_minor?: string | number
          paid_count?: number
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clawback_resolutions_deducted_from_payout_id_fkey"
            columns: ["deducted_from_payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clawback_resolutions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clawback_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_ledger: {
        Row: {
          amount_minor: string | number
          basis_pv: number
          commission_basis_minor: string | number
          config_commission_rate_id: number
          currency: string
          distributor_id: number
          earned_at: string
          id: number
          level: number
          payout_id: number | null
          rate_basis_points: number
          source_distributor_id: number
          source_order_id: number
        }
        Insert: {
          amount_minor: string | number
          basis_pv?: number
          commission_basis_minor: string | number
          config_commission_rate_id: number
          currency?: string
          distributor_id: number
          earned_at?: string
          id?: number
          level: number
          payout_id?: number | null
          rate_basis_points: number
          source_distributor_id: number
          source_order_id: number
        }
        Update: {
          amount_minor?: string | number
          basis_pv?: number
          commission_basis_minor?: string | number
          config_commission_rate_id?: number
          currency?: string
          distributor_id?: number
          earned_at?: string
          id?: number
          level?: number
          payout_id?: number | null
          rate_basis_points?: number
          source_distributor_id?: number
          source_order_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_config_commission_rate_id_fkey"
            columns: ["config_commission_rate_id"]
            isOneToOne: false
            referencedRelation: "config_commission_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_source_distributor_id_fkey"
            columns: ["source_distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      config_commission_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: number
          level: number
          notes: string | null
          rate_basis_points: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: number
          level: number
          notes?: string | null
          rate_basis_points: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: number
          level?: number
          notes?: string | null
          rate_basis_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "config_commission_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config_ranks: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          emoji: string | null
          id: number
          maintenance_grace_months: number | null
          min_active_customers: number | null
          min_active_recruits: number
          min_group_sales_minor: string | number
          min_personal_pv: number | null
          min_personal_sales_minor: string | number | null
          notes: string | null
          qualifying_months: number | null
          rank_name: string
          rank_position: number
          rank_up_bonus_minor: string | number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          emoji?: string | null
          id?: number
          maintenance_grace_months?: number | null
          min_active_customers?: number | null
          min_active_recruits?: number
          min_group_sales_minor?: string | number
          min_personal_pv?: number | null
          min_personal_sales_minor?: string | number | null
          notes?: string | null
          qualifying_months?: number | null
          rank_name: string
          rank_position: number
          rank_up_bonus_minor?: string | number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          emoji?: string | null
          id?: number
          maintenance_grace_months?: number | null
          min_active_customers?: number | null
          min_active_recruits?: number
          min_group_sales_minor?: string | number
          min_personal_pv?: number | null
          min_personal_sales_minor?: string | number | null
          notes?: string | null
          qualifying_months?: number | null
          rank_name?: string
          rank_position?: number
          rank_up_bonus_minor?: string | number
        }
        Relationships: [
          {
            foreignKeyName: "config_ranks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config_salary_tiers: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          fixed_salary_minor: string | number
          id: number
          min_personal_bottles: number
          min_team_gsv_minor: string | number
          performance_bonus_basis_points: number
          rank_position: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          fixed_salary_minor?: string | number
          id?: number
          min_personal_bottles?: number
          min_team_gsv_minor?: string | number
          performance_bonus_basis_points?: number
          rank_position: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          fixed_salary_minor?: string | number
          id?: number
          min_personal_bottles?: number
          min_team_gsv_minor?: string | number
          performance_bonus_basis_points?: number
          rank_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "config_salary_tiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config_settings: {
        Row: {
          key: string
          notes: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "config_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config_starter_packages: {
        Row: {
          bundle_id: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: number
          joining_fee_minor: string | number
          package_code: string
        }
        Insert: {
          bundle_id: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: number
          joining_fee_minor: string | number
          package_code: string
        }
        Update: {
          bundle_id?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: number
          joining_fee_minor?: string | number
          package_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_starter_packages_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "config_starter_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distributor_tree: {
        Row: {
          ancestor_id: number
          depth: number
          descendant_id: number
        }
        Insert: {
          ancestor_id: number
          depth: number
          descendant_id: number
        }
        Update: {
          ancestor_id?: number
          depth?: number
          descendant_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "distributor_tree_ancestor_id_fkey"
            columns: ["ancestor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_tree_descendant_id_fkey"
            columns: ["descendant_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          created_at: string
          current_rank_achieved_at: string | null
          current_rank_id: number | null
          id: number
          is_active: boolean
          joined_at: string
          kyc_approved_at: string | null
          kyc_status: string
          payout_msisdn: string | null
          payout_msisdn_pending: string | null
          payout_msisdn_pending_at: string | null
          payout_msisdn_verified_at: string | null
          sponsor_code: string
          sponsor_id: number | null
          starter_package_id: number | null
          starter_paid_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_rank_achieved_at?: string | null
          current_rank_id?: number | null
          id?: number
          is_active?: boolean
          joined_at?: string
          kyc_approved_at?: string | null
          kyc_status?: string
          payout_msisdn?: string | null
          payout_msisdn_pending?: string | null
          payout_msisdn_pending_at?: string | null
          payout_msisdn_verified_at?: string | null
          sponsor_code: string
          sponsor_id?: number | null
          starter_package_id?: number | null
          starter_paid_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_rank_achieved_at?: string | null
          current_rank_id?: number | null
          id?: number
          is_active?: boolean
          joined_at?: string
          kyc_approved_at?: string | null
          kyc_status?: string
          payout_msisdn?: string | null
          payout_msisdn_pending?: string | null
          payout_msisdn_pending_at?: string | null
          payout_msisdn_verified_at?: string | null
          sponsor_code?: string
          sponsor_id?: number | null
          starter_package_id?: number | null
          starter_paid_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributors_current_rank_id_fkey"
            columns: ["current_rank_id"]
            isOneToOne: false
            referencedRelation: "config_ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributors_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributors_starter_package_id_fkey"
            columns: ["starter_package_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gsv_snapshots: {
        Row: {
          active_customers_count: number
          active_recruits_count: number
          computed_at: string
          distributor_id: number
          id: number
          period_month: number
          period_year: number
          personal_bottles_sold: number
          personal_sales_minor: string | number
          team_gsv_minor: string | number
        }
        Insert: {
          active_customers_count?: number
          active_recruits_count?: number
          computed_at?: string
          distributor_id: number
          id?: number
          period_month: number
          period_year: number
          personal_bottles_sold?: number
          personal_sales_minor?: string | number
          team_gsv_minor?: string | number
        }
        Update: {
          active_customers_count?: number
          active_recruits_count?: number
          computed_at?: string
          distributor_id?: number
          id?: number
          period_month?: number
          period_year?: number
          personal_bottles_sold?: number
          personal_sales_minor?: string | number
          team_gsv_minor?: string | number
        }
        Relationships: [
          {
            foreignKeyName: "gsv_snapshots_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_reviews: {
        Row: {
          author_city: string | null
          author_name: string
          created_at: string
          created_by: string | null
          id: number
          is_published: boolean
          position: number
          product_id: number | null
          quote: string
        }
        Insert: {
          author_city?: string | null
          author_name: string
          created_at?: string
          created_by?: string | null
          id?: number
          is_published?: boolean
          position?: number
          product_id?: number | null
          quote: string
        }
        Update: {
          author_city?: string | null
          author_name?: string
          created_at?: string
          created_by?: string | null
          id?: number
          is_published?: boolean
          position?: number
          product_id?: number | null
          quote?: string
        }
        Relationships: [
          {
            foreignKeyName: "homepage_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homepage_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_ledger_adjustments: {
        Row: {
          actor_id: string | null
          amount_minor: string | number
          created_at: string
          currency: string
          distributor_id: number
          id: number
          payout_id: number | null
          period_month: number
          period_year: number
          reason: string
        }
        Insert: {
          actor_id?: string | null
          amount_minor: string | number
          created_at?: string
          currency?: string
          distributor_id: number
          id?: number
          payout_id?: number | null
          period_month: number
          period_year: number
          reason: string
        }
        Update: {
          actor_id?: string | null
          amount_minor?: string | number
          created_at?: string
          currency?: string
          distributor_id?: number
          id?: number
          payout_id?: number | null
          period_month?: number
          period_year?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_ledger_adjustments_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_ledger_adjustments_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_ledger_adjustments_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_salaries: {
        Row: {
          computed_at: string
          distributor_id: number
          fixed_salary_minor: string | number
          id: number
          payout_id: number | null
          performance_bonus_minor: string | number
          period_month: number
          period_year: number
          personal_bottles_sold: number
          qualified: boolean
          rank_at_period_id: number
          team_gsv_minor: string | number
          total_minor: string | number
        }
        Insert: {
          computed_at?: string
          distributor_id: number
          fixed_salary_minor?: string | number
          id?: number
          payout_id?: number | null
          performance_bonus_minor?: string | number
          period_month: number
          period_year: number
          personal_bottles_sold?: number
          qualified: boolean
          rank_at_period_id: number
          team_gsv_minor?: string | number
          total_minor?: string | number
        }
        Update: {
          computed_at?: string
          distributor_id?: number
          fixed_salary_minor?: string | number
          id?: number
          payout_id?: number | null
          performance_bonus_minor?: string | number
          period_month?: number
          period_year?: number
          personal_bottles_sold?: number
          qualified?: boolean
          rank_at_period_id?: number
          team_gsv_minor?: string | number
          total_minor?: string | number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_salaries_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_salaries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_salaries_rank_at_period_id_fkey"
            columns: ["rank_at_period_id"]
            isOneToOne: false
            referencedRelation: "config_ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      msisdn_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          distributor_id: number
          expires_at: string
          id: number
          msisdn: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          distributor_id: number
          expires_at: string
          id?: number
          msisdn: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          distributor_id?: number
          expires_at?: string
          id?: number
          msisdn?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "msisdn_verifications_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          bundle_id: number | null
          commission_pv: number
          commissionable_amount_minor: string | number
          id: number
          is_commissionable: boolean
          line_total_minor: string | number
          order_id: number
          quantity: number
          unit_price_minor: string | number
          variant_id: number | null
        }
        Insert: {
          bundle_id?: number | null
          commission_pv?: number
          commissionable_amount_minor?: string | number
          id?: number
          is_commissionable?: boolean
          line_total_minor: string | number
          order_id: number
          quantity: number
          unit_price_minor: string | number
          variant_id?: number | null
        }
        Update: {
          bundle_id?: number | null
          commission_pv?: number
          commissionable_amount_minor?: string | number
          id?: number
          is_commissionable?: boolean
          line_total_minor?: string | number
          order_id?: number
          quantity?: number
          unit_price_minor?: string | number
          variant_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          callback_verified: boolean | null
          created_at: string
          currency: string
          customer_email: string
          customer_phone: string | null
          discount_minor: string | number
          id: number
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["order_kind"]
          mpesa_receipt: string | null
          notes: string | null
          order_number: string
          paid_at: string | null
          payhero_checkout_reference: string | null
          payhero_external_reference: string | null
          payhero_mpesa_receipt: string | null
          payment_provider: string | null
          payment_provider_ref: string | null
          processing_fee_minor: string | number
          raw_callback: Json | null
          shipping_address_id: number | null
          shipping_minor: string | number
          sponsor_distributor_id: number | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_minor: string | number
          tax_minor: string | number
          total_minor: string | number
          updated_at: string
          user_id: string | null
          verification_status: string | null
        }
        Insert: {
          callback_verified?: boolean | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_phone?: string | null
          discount_minor?: string | number
          id?: number
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["order_kind"]
          mpesa_receipt?: string | null
          notes?: string | null
          order_number: string
          paid_at?: string | null
          payhero_checkout_reference?: string | null
          payhero_external_reference?: string | null
          payhero_mpesa_receipt?: string | null
          payment_provider?: string | null
          payment_provider_ref?: string | null
          processing_fee_minor?: string | number
          raw_callback?: Json | null
          shipping_address_id?: number | null
          shipping_minor?: string | number
          sponsor_distributor_id?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor: string | number
          tax_minor?: string | number
          total_minor: string | number
          updated_at?: string
          user_id?: string | null
          verification_status?: string | null
        }
        Update: {
          callback_verified?: boolean | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_phone?: string | null
          discount_minor?: string | number
          id?: number
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["order_kind"]
          mpesa_receipt?: string | null
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payhero_checkout_reference?: string | null
          payhero_external_reference?: string | null
          payhero_mpesa_receipt?: string | null
          payment_provider?: string | null
          payment_provider_ref?: string | null
          processing_fee_minor?: string | number
          raw_callback?: Json | null
          shipping_address_id?: number | null
          shipping_minor?: string | number
          sponsor_distributor_id?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_minor?: string | number
          tax_minor?: string | number
          total_minor?: string | number
          updated_at?: string
          user_id?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sponsor_distributor_id_fkey"
            columns: ["sponsor_distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          attempt_type: string
          attempted_at: string
          error_message: string | null
          http_status: number | null
          id: number
          order_id: number | null
          provider: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
        }
        Insert: {
          attempt_type: string
          attempted_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: number
          order_id?: number | null
          provider: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
        }
        Update: {
          attempt_type?: string
          attempted_at?: string
          error_message?: string | null
          http_status?: number | null
          id?: number
          order_id?: number | null
          provider?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_logs: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          order_code: string | null
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          order_code?: string | null
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          order_code?: string | null
          payload?: Json | null
        }
        Relationships: []
      }
      payouts: {
        Row: {
          commissions_total_minor: string | number
          completed_at: string | null
          created_at: string
          currency: string
          distributor_id: number
          failure_reason: string | null
          fees_minor: string | number
          flutterwave_transfer_id: string | null
          gross_total_minor: string | number
          id: number
          initiated_at: string | null
          net_total_minor: string | number
          payhero_mpesa_receipt: string | null
          payhero_transfer_reference: string | null
          payout_method: string
          payout_msisdn: string | null
          period_month: number
          period_year: number
          provider: string
          rank_bonus_total_minor: string | number
          retail_profit_minor: string | number
          salary_total_minor: string | number
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          commissions_total_minor?: string | number
          completed_at?: string | null
          created_at?: string
          currency?: string
          distributor_id: number
          failure_reason?: string | null
          fees_minor?: string | number
          flutterwave_transfer_id?: string | null
          gross_total_minor: string | number
          id?: number
          initiated_at?: string | null
          net_total_minor: string | number
          payhero_mpesa_receipt?: string | null
          payhero_transfer_reference?: string | null
          payout_method?: string
          payout_msisdn?: string | null
          period_month: number
          period_year: number
          provider?: string
          rank_bonus_total_minor?: string | number
          retail_profit_minor?: string | number
          salary_total_minor?: string | number
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          commissions_total_minor?: string | number
          completed_at?: string | null
          created_at?: string
          currency?: string
          distributor_id?: number
          failure_reason?: string | null
          fees_minor?: string | number
          flutterwave_transfer_id?: string | null
          gross_total_minor?: string | number
          id?: number
          initiated_at?: string | null
          net_total_minor?: string | number
          payhero_mpesa_receipt?: string | null
          payhero_transfer_reference?: string | null
          payout_method?: string
          payout_msisdn?: string | null
          period_month?: number
          period_year?: number
          provider?: string
          rank_bonus_total_minor?: string | number
          retail_profit_minor?: string | number
          salary_total_minor?: string | number
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payouts_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      press_features: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          is_published: boolean
          name: string
          position: number
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: number
          is_published?: boolean
          name: string
          position?: number
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          is_published?: boolean
          name?: string
          position?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "press_features_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fragrance_meta: {
        Row: {
          base_notes: string[]
          climate_note: string | null
          created_at: string
          heart_notes: string[]
          inspired_by: string | null
          longevity: string | null
          occasions: string[]
          product_id: number
          projection: string | null
          scent_family: string | null
          story: string | null
          top_notes: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_notes?: string[]
          climate_note?: string | null
          created_at?: string
          heart_notes?: string[]
          inspired_by?: string | null
          longevity?: string | null
          occasions?: string[]
          product_id: number
          projection?: string | null
          scent_family?: string | null
          story?: string | null
          top_notes?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_notes?: string[]
          climate_note?: string | null
          created_at?: string
          heart_notes?: string[]
          inspired_by?: string | null
          longevity?: string | null
          occasions?: string[]
          product_id?: number
          projection?: string | null
          scent_family?: string | null
          story?: string | null
          top_notes?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_fragrance_meta_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fragrance_meta_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          height: number | null
          id: number
          is_primary: boolean
          position: number
          product_id: number
          storage_prefix: string
          variant_id: number | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: number
          is_primary?: boolean
          position?: number
          product_id: number
          storage_prefix: string
          variant_id?: number | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: number
          is_primary?: boolean
          position?: number
          product_id?: number
          storage_prefix?: string
          variant_id?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          distributor_price_minor: string | number
          id: number
          inventory_qty: number
          is_active: boolean
          product_id: number
          pv_per_bottle: number
          retail_price_minor: string | number
          selling_price_minor: string | number | null
          size_ml: number
          sku: string
          weight_g: number | null
        }
        Insert: {
          created_at?: string
          distributor_price_minor: string | number
          id?: number
          inventory_qty?: number
          is_active?: boolean
          product_id: number
          pv_per_bottle?: number
          retail_price_minor: string | number
          selling_price_minor?: string | number | null
          size_ml: number
          sku: string
          weight_g?: number | null
        }
        Update: {
          created_at?: string
          distributor_price_minor?: string | number
          id?: number
          inventory_qty?: number
          is_active?: boolean
          product_id?: number
          pv_per_bottle?: number
          retail_price_minor?: string | number
          selling_price_minor?: string | number | null
          size_ml?: number
          sku?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: number | null
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country_code: string
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string
          id: string
          marketing_consent_at: string | null
          national_id: string | null
          phone: string | null
          preferred_currency: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name: string
          id: string
          marketing_consent_at?: string | null
          national_id?: string | null
          phone?: string | null
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string
          id?: string
          marketing_consent_at?: string | null
          national_id?: string | null
          phone?: string | null
          preferred_currency?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      rank_up_bonuses: {
        Row: {
          amount_minor: string | number
          awarded_at: string
          distributor_id: number
          id: number
          payout_id: number | null
          rank_id: number
        }
        Insert: {
          amount_minor: string | number
          awarded_at?: string
          distributor_id: number
          id?: number
          payout_id?: number | null
          rank_id: number
        }
        Update: {
          amount_minor?: string | number
          awarded_at?: string
          distributor_id?: number
          id?: number
          payout_id?: number | null
          rank_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rank_up_bonuses_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_up_bonuses_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_up_bonuses_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "config_ranks"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          body: Json
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: Json
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: Json
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: number
          revoked_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: number
          revoked_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: number
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          body: Json
          error: string | null
          event_id: string
          event_type: string | null
          id: number
          processed_at: string | null
          provider: string
          received_at: string
          signature_ok: boolean
        }
        Insert: {
          body: Json
          error?: string | null
          event_id: string
          event_type?: string | null
          id?: number
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_ok: boolean
        }
        Update: {
          body?: Json
          error?: string | null
          event_id?: string
          event_type?: string | null
          id?: number
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_ok?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_distributor_to_tree: {
        Args: { p_new_distributor_id: number; p_parent_distributor_id: number }
        Returns: undefined
      }
      apply_clawback_deduction: {
        Args: { p_resolution_id: number }
        Returns: boolean
      }
      compute_gsv_snapshot: {
        Args: { p_distributor_id: number; p_month: number; p_year: number }
        Returns: number
      }
      compute_monthly_salary: {
        Args: { p_distributor_id: number; p_month: number; p_year: number }
        Returns: number
      }
      count_qualifying_streak: {
        Args: {
          p_distributor_id: number
          p_ending_month: number
          p_ending_year: number
          p_max: number
          p_target_rank_id: number
        }
        Returns: number
      }
      current_distributor_id: { Args: never; Returns: number }
      default_sponsor_code: { Args: never; Returns: string }
      detect_rank_up: {
        Args: { p_distributor_id: number; p_month: number; p_year: number }
        Returns: number
      }
      generate_order_number: { Args: never; Returns: string }
      generate_sponsor_code: { Args: never; Returns: string }
      get_setting_bool: {
        Args: { p_default: boolean; p_key: string }
        Returns: boolean
      }
      has_role: {
        Args: { target_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_distributor_maintained: {
        Args: { p_distributor_id: number; p_month: number; p_year: number }
        Returns: boolean
      }
      is_distributor_meeting_pv: {
        Args: { p_distributor_id: number; p_month: number; p_year: number }
        Returns: boolean
      }
      is_distributor_qualified_for_rank: {
        Args: {
          p_distributor_id: number
          p_month: number
          p_rank_id: number
          p_year: number
        }
        Returns: boolean
      }
      mark_order_paid: {
        Args: { p_order_id: number; p_paid_at?: string; p_provider_ref: string }
        Returns: boolean
      }
      mark_webhook_processed: {
        Args: { p_error?: string; p_event_id: string; p_provider: string }
        Returns: undefined
      }
      provision_distributor: { Args: { p_order_id: number }; Returns: number }
      rebuild_distributor_tree_for: {
        Args: { p_distributor_id: number }
        Returns: number
      }
      record_webhook_delivery: {
        Args: {
          p_body: Json
          p_event_id: string
          p_event_type: string
          p_provider: string
          p_signature_ok: boolean
        }
        Returns: boolean
      }
      restore_order_inventory: {
        Args: { p_order_id: number }
        Returns: boolean
      }
      void_unpaid_commissions_for_order: {
        Args: { p_order_id: number }
        Returns: Json
      }
      write_commission_ledger: { Args: { p_order_id: number }; Returns: number }
    }
    Enums: {
      order_kind: "retail" | "distributor_signup" | "distributor_restock"
      order_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "fulfilled"
        | "shipped"
        | "delivered"
        | "refunded"
        | "expired"
      payout_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "reversed"
      user_role: "customer" | "distributor" | "admin" | "superadmin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      order_kind: ["retail", "distributor_signup", "distributor_restock"],
      order_status: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "fulfilled",
        "shipped",
        "delivered",
        "refunded",
        "expired",
      ],
      payout_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "reversed",
      ],
      user_role: ["customer", "distributor", "admin", "superadmin"],
    },
  },
} as const
