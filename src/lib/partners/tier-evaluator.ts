/**
 * Pure tier-evaluation logic — Phase 2a.
 *
 * Given the partner's current tier, latest qualification metrics, and
 * the full tier ladder, decide whether to hold, advance, warn before
 * downgrade, or downgrade.
 *
 * Pure function. Zero I/O. Unit-testable in isolation against table-
 * driven cases. The materialized view + DB lookups happen elsewhere
 * (see `src/lib/partners/qualification.ts`); this module just makes
 * the decision once everything is in memory.
 *
 * Phase 2a uses this on the read-only admin display only. Phase 2b's
 * quarterly-review action consumes the same return value to populate
 * `retention_bonus_grants` rows or to enqueue tier downgrades.
 */

import type {
  PartnerTier,
  PartnerQualification,
  PartnerFlags,
  TierEvaluation,
  QualificationRules,
} from './types'

/**
 * Evaluate whether a partner's tier should hold, advance, or downgrade.
 *
 * @param currentTier   the partner's current tier row, or null if they
 *                      haven't been assigned a tier yet (in which case
 *                      we treat them as candidate for tier 1)
 * @param qualification rolling 90-day metrics from
 *                      `partner_qualifications` materialized view, or
 *                      null if no metrics have been computed yet
 * @param flags         binary partner flags (content creator approval,
 *                      verified customer)
 * @param tiers         the full 4-tier ladder, ordered by tier_position
 *                      ascending
 */
export function evaluatePartnerTier(
  currentTier: PartnerTier | null,
  qualification: PartnerQualification | null,
  flags: PartnerFlags,
  tiers: PartnerTier[],
): TierEvaluation {
  const ladder = [...tiers].sort((a, b) => a.tier_position - b.tier_position)

  // No tier yet: candidate for tier 1 if any tier-1 rule holds.
  if (!currentTier) {
    const tier1 = ladder.find((t) => t.tier_position === 1)
    if (!tier1) {
      return { type: 'hold', reason: 'No tier ladder configured.' }
    }
    if (meetsRules(tier1.qualification_rules, qualification, flags)) {
      return {
        type: 'advance',
        toTierPosition: 1,
        reason: 'Eligible for Concierge Partner.',
      }
    }
    return {
      type: 'hold',
      reason: 'Not yet eligible for entry tier (Concierge Partner).',
    }
  }

  const currentRules = currentTier.qualification_rules
  const meetsCurrent = meetsRules(currentRules, qualification, flags)

  // Try to advance to the next tier if eligible.
  const nextTier = ladder.find(
    (t) => t.tier_position === currentTier.tier_position + 1,
  )
  if (nextTier && meetsRules(nextTier.qualification_rules, qualification, flags)) {
    return {
      type: 'advance',
      toTierPosition: nextTier.tier_position,
      reason: `Exceeds ${nextTier.display_name} qualification.`,
    }
  }

  // Hold at current tier if still qualified.
  if (meetsCurrent) {
    return {
      type: 'hold',
      reason: `Holds ${currentTier.display_name}.`,
    }
  }

  // Fallen below current tier requirements.
  // Tier 1 has no downgrade target — keep on hold with a warning (admin
  // can deactivate manually if needed).
  if (currentTier.tier_position <= 1) {
    return {
      type: 'downgrade_warn',
      reason: 'Below entry-tier requirements but no lower tier to demote to.',
    }
  }

  // Phase 2a returns `downgrade_warn` always — the 30-day grace window
  // logic lives in the quarterly-review batch that Phase 2b ships. This
  // module is pure and stateless; it can't know how long the partner
  // has been below threshold without that batch context.
  return {
    type: 'downgrade_warn',
    reason: `Below ${currentTier.display_name} requirements — grace window.`,
  }
}

/**
 * Apply the `qualification_rules` JSONB shape to the available metrics.
 * Returns true if ALL specified requirements pass. Missing fields are
 * treated as "no requirement" (a tier with `{}` rules always passes).
 */
function meetsRules(
  rules: QualificationRules,
  qualification: PartnerQualification | null,
  flags: PartnerFlags,
): boolean {
  // requires_any — any-of gate against flags.
  if (rules.requires_any && rules.requires_any.length > 0) {
    const anyHolds = rules.requires_any.some((req) => {
      if (req === 'verified_content_creator') return flags.verified_content_creator
      if (req === 'verified_customer')        return flags.verified_customer
      return false
    })
    if (!anyHolds) return false
  }

  // Numeric thresholds — all-of.
  if (rules.min_90d_retail_minor !== undefined) {
    const revenue = Number(qualification?.verified_revenue_90d_minor ?? 0)
    if (revenue < rules.min_90d_retail_minor) return false
  }
  if (rules.min_retention_score !== undefined) {
    const score = qualification?.retention_score_90d ?? 0
    if (score < rules.min_retention_score) return false
  }
  if (rules.min_unique_buyers_90d !== undefined) {
    const buyers = qualification?.unique_buyers_90d ?? 0
    if (buyers < rules.min_unique_buyers_90d) return false
  }

  // min_90d_post_count — needs content tracking which is Phase 4+. For
  // Phase 2a we treat content as 0 (so any tier requiring posts fails).
  if (rules.min_90d_post_count !== undefined && rules.min_90d_post_count > 0) {
    return false
  }

  // quarterly_review_required + brand_compliance_required — Prestige
  // tier flags. Phase 2a returns `hold` for these; Phase 2b's admin
  // batch handles the explicit approval flow.
  if (rules.quarterly_review_required) {
    // Without a recorded admin approval, can't advance into Prestige.
    return false
  }
  if (rules.brand_compliance_required) {
    return false
  }

  return true
}
