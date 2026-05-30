/**
 * Display-layer model for the 5 partner ranks (config_ranks positions 1..5),
 * adopted from the client compensation plan (2026-05-22). This replaces the
 * earlier 4-tier bridge (Concierge / Brand Associate / Regional Curator /
 * Prestige), which is shelved along with the inert v2 tier engine. See the
 * transformation masterplan, Appendix C.
 *
 *   1. Ambassador
 *   2. Executive
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
    | 'executive'
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
    tagline: 'Where every partnership begins — earn on every fragrance you place.',
    commissionLabel: 'Level 1 network commission',
    bonusLabel: 'Full retail margin on every bottle you sell',
  },
  2: {
    position: 2,
    code: 'executive',
    displayName: 'Executive',
    tagline: 'Build a team and earn two levels into your network.',
    commissionLabel: 'Levels 1–2 network commission',
    bonusLabel: 'Monthly lifestyle bonus on target',
  },
  3: {
    position: 3,
    code: 'gold_director',
    displayName: 'Gold Director',
    tagline: 'Lead a growing organisation across three network levels.',
    commissionLabel: 'Levels 1–3 network commission',
    bonusLabel: 'Higher monthly lifestyle bonus on target',
  },
  4: {
    position: 4,
    code: 'platinum_director',
    displayName: 'Platinum Director',
    tagline: 'A senior leader with deep team earnings and brand access.',
    commissionLabel: 'Levels 1–4 network commission',
    bonusLabel: 'Premium monthly lifestyle bonus on target',
  },
  5: {
    position: 5,
    code: 'crown_president',
    displayName: 'Crown President',
    tagline: 'The house’s inner circle — the full earning ladder and top recognition.',
    commissionLabel: 'Levels 1–5 network commission',
    bonusLabel: 'Top monthly lifestyle bonus on target',
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
