/**
 * Partner-tier domain types — Phase 2a.
 *
 * Mirrors the partner_tiers table + partner_qualifications materialized
 * view introduced by migrations 023 + 024. Pure types; no runtime
 * imports. Safe to share between server and client code.
 *
 * TODO(types): regenerate src/types/database.ts post-023/024 to get
 * supabase-js's typed query builder back. Until then, server modules
 * cast through unknown to land in these types.
 */

/** Row in the `partner_tiers` config table. */
export interface PartnerTier {
  id: number
  /** 1..4 — Concierge / Brand Associate / Regional Curator / Prestige. */
  tier_position: number
  /** Stable string id, e.g. `'brand_associate'`. */
  tier_code: string
  /** Customer-facing label, e.g. `'Brand Associate'`. */
  display_name: string
  /** Direct commission rate, basis points (1000 = 10%). */
  direct_rate_basis_points: number
  /** Override on referrals, basis points. */
  override_rate_basis_points: number
  /** Max tier_position this tier can refer (0 = none). */
  can_refer_tier_max: number
  /** Tunable thresholds + flags — see {@link QualificationRules}. */
  qualification_rules: QualificationRules
  effective_from: string
  effective_until: string | null
  created_at: string
}

/**
 * Shape of `partner_tiers.qualification_rules` JSONB.
 *
 * Each tier sets the subset of fields it cares about. Evaluator treats
 * missing fields as "no requirement". See {@link evaluatePartnerTier}.
 */
export interface QualificationRules {
  /** Any-of: tier qualifies if ANY of the listed flags hold. */
  requires_any?: Array<
    | 'verified_content_creator'
    | 'verified_customer'
  >
  /** All-of thresholds — numeric requirements. */
  /** Minimum verified retail revenue over rolling 90 days, in minor units. */
  min_90d_retail_minor?: number
  /** Retention score (repeat-buyer ratio), 0..1. */
  min_retention_score?: number
  /** Minimum distinct buyers in the rolling 90-day window. */
  min_unique_buyers_90d?: number
  /** Minimum verified content posts in the 90-day window. */
  min_90d_post_count?: number
  /** Flag — Prestige reviewed quarterly by admin batch. */
  quarterly_review_required?: boolean
  /** Flag — Prestige requires brand-compliance check. */
  brand_compliance_required?: boolean
}

/** One row from the `partner_qualifications` materialized view. */
export interface PartnerQualification {
  distributor_id: number
  verified_revenue_90d_minor: bigint
  unique_buyers_90d: number
  paid_orders_90d: number
  retention_score_90d: number
  computed_at: string
}

/**
 * Decision returned by {@link evaluatePartnerTier}.
 *
 * - `hold`            — current tier is correct; no action.
 * - `advance`         — partner exceeds the next tier's qualification.
 * - `downgrade_warn`  — partner has fallen below their current tier's
 *                       requirements; in the 30-day grace window.
 * - `downgrade`       — partner has been below threshold past the grace
 *                       window; downgrade to one tier lower.
 *
 * Phase 2a surfaces this decision on the admin page only. Phase 2b's
 * quarterly review action consumes it programmatically.
 */
export type TierEvaluation =
  | { type: 'hold'; reason: string }
  | { type: 'advance'; toTierPosition: number; reason: string }
  | { type: 'downgrade_warn'; reason: string }
  | { type: 'downgrade'; toTierPosition: number; reason: string }

/** Partner flags captured during evaluation. Drives advance gating. */
export interface PartnerFlags {
  /** Manual admin approval on a content_creator_application row. */
  verified_content_creator: boolean
  /** Has at least one paid retail order (≥1) — Phase 2a default. */
  verified_customer: boolean
}
