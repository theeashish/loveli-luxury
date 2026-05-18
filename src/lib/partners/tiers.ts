/**
 * Phase 1 display-layer mapping from the 8 internal ranks
 * (`config_ranks.position 1..8`) to the 4 customer-facing partner tiers
 * locked in the brand brief on 2026-05-18:
 *
 *   1. Concierge Partner
 *   2. Brand Associate
 *   3. Regional Curator
 *   4. Prestige Partner
 *
 * Phase 2 replaces this thin bridge with a direct `distributors.current_tier_id`
 * lookup against the new `partner_tiers` config table (see MIGRATION_NOTES.md
 * §1). For Phase 1 the DB schema is untouched — this module is the seam.
 *
 * Pure. No I/O. No imports beyond types.
 */

export type PartnerTierPosition = 1 | 2 | 3 | 4

export interface PartnerTier {
  position: PartnerTierPosition
  code:
    | 'concierge_partner'
    | 'brand_associate'
    | 'regional_curator'
    | 'prestige_partner'
  displayName: string
  tagline: string
  /** Direct sales rate as a human percentage label (UI only). */
  directRateLabel: string
  /** Override label as a human string (UI only). */
  overrideLabel: string
}

const TIERS: Record<PartnerTierPosition, PartnerTier> = {
  1: {
    position: 1,
    code: 'concierge_partner',
    displayName: 'Concierge Partner',
    tagline:
      'Earn alongside the house — 10% on every fragrance you introduce.',
    directRateLabel: '10% on direct sales',
    overrideLabel: 'No team override',
  },
  2: {
    position: 2,
    code: 'brand_associate',
    displayName: 'Brand Associate',
    tagline:
      '15% on direct sales, plus 3% on the Concierge Partners you sponsor.',
    directRateLabel: '15% on direct sales',
    overrideLabel: '3% override on sponsored Concierge Partners',
  },
  3: {
    position: 3,
    code: 'regional_curator',
    displayName: 'Regional Curator',
    tagline:
      '20% direct, tiered team override, and access to regional launches.',
    directRateLabel: '20% on direct sales',
    overrideLabel: 'Tiered team override',
  },
  4: {
    position: 4,
    code: 'prestige_partner',
    displayName: 'Prestige Partner',
    tagline:
      'Luxury bonuses, event access, regional rights, limited-edition allocation.',
    directRateLabel: '20% on direct sales + luxury bonuses',
    overrideLabel: 'Tiered team override + regional rights',
  },
}

/**
 * Map an 8-rank position to its 4-tier display.
 *
 * Phase 1 bridge: ranks 1-2 → Concierge Partner, 3-4 → Brand Associate,
 * 5-6 → Regional Curator, 7-8 → Prestige Partner. Out-of-range inputs
 * (null/undefined/<=0/>8) collapse to Concierge Partner — the safe
 * default for a freshly-provisioned partner with no rank yet.
 */
export function partnerTierForRank(
  rankPosition: number | null | undefined,
): PartnerTier {
  if (rankPosition == null || rankPosition < 1) return TIERS[1]
  if (rankPosition <= 2) return TIERS[1]
  if (rankPosition <= 4) return TIERS[2]
  if (rankPosition <= 6) return TIERS[3]
  return TIERS[4]
}

export function getPartnerTier(position: PartnerTierPosition): PartnerTier {
  return TIERS[position]
}

/** Iteration helper for any "render all 4 tiers" UI (e.g. the boss-scents page). */
export const ALL_PARTNER_TIERS: readonly PartnerTier[] = [
  TIERS[1],
  TIERS[2],
  TIERS[3],
  TIERS[4],
]
