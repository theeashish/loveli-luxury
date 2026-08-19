/**
 * Display-layer model for the 5 partner ranks (config_ranks positions 1..5),
 * adopted from the client compensation plan (2026-05-22). This replaces the
 * earlier 4-tier bridge (Concierge / Brand Associate / Regional Curator /
 * Prestige), which is shelved along with the inert v2 tier engine. See the
 * transformation masterplan, Appendix C.
 *
 *   1. Ambassador
 *   2. Active
 *   3. Gold Director
 *   4. Platinum Director
 *   5. Crown President
 *
 * Backend ranks map 1:1 to these (config_ranks.rank_position). Commission
 * rates are partner-only — shown on /account/partner/earnings, never on the
 * public /partners page.
 *
 * Pure. No I/O. No imports beyond types.
 */

export type PartnerTierPosition = 1 | 2 | 3 | 4 | 5

export interface PartnerTier {
  position: PartnerTierPosition
  code:
    | 'ambassador'
    | 'active'
    | 'gold_director'
    | 'platinum_director'
    | 'crown_president'
  displayName: string
  tagline: string
  /** Network commission depth — partner-only earnings copy. */
  commissionLabel: string
  /** Lifestyle bonus / retail margin line — partner-only earnings copy. */
  bonusLabel: string
}

const TIERS: Record<PartnerTierPosition, PartnerTier> = {
  1: {
    position: 1,
    code: 'ambassador',
    displayName: 'Ambassador',
    tagline: 'Start here and earn from your first level.',
    commissionLabel: 'Level 1 commission',
    bonusLabel: 'Retail profit on each bottle you sell',
  },
  2: {
    position: 2,
    code: 'active',
    displayName: 'Active',
    tagline: 'Meet the Active rank requirements and earn from two levels.',
    commissionLabel: 'Levels 1-2 commission',
    bonusLabel: 'Monthly bonus when you meet the target',
  },
  3: {
    position: 3,
    code: 'gold_director',
    displayName: 'Gold Director',
    tagline: 'Lead a team and earn from three levels.',
    commissionLabel: 'Levels 1-3 commission',
    bonusLabel: 'Higher monthly bonus when you meet the target',
  },
  4: {
    position: 4,
    code: 'platinum_director',
    displayName: 'Platinum Director',
    tagline: 'Lead a larger team and earn from four levels.',
    commissionLabel: 'Levels 1-4 commission',
    bonusLabel: 'Premium monthly bonus when you meet the target',
  },
  5: {
    position: 5,
    code: 'crown_president',
    displayName: 'Crown President',
    tagline: 'Reach the top band and earn from five levels.',
    commissionLabel: 'Levels 1-5 commission',
    bonusLabel: 'Top monthly bonus when you meet the target',
  },
}

/**
 * Map a backend rank position to its display rank. Ranks are 1..5 (1:1).
 * Out-of-range inputs (null/undefined/<1) collapse to Ambassador — the safe
 * default for a freshly-provisioned partner with no rank yet; >5 caps at
 * Crown President.
 */
export function partnerTierForRank(
  rankPosition: number | null | undefined,
): PartnerTier {
  if (rankPosition == null || rankPosition < 1) return TIERS[1]
  const p = Math.min(5, Math.floor(rankPosition)) as PartnerTierPosition
  return TIERS[p]
}

export function getPartnerTier(position: PartnerTierPosition): PartnerTier {
  return TIERS[position]
}

/** Iteration helper for any "render all ranks" UI (e.g. the /partners page). */
export const ALL_PARTNER_TIERS: readonly PartnerTier[] = [
  TIERS[1],
  TIERS[2],
  TIERS[3],
  TIERS[4],
  TIERS[5],
]
