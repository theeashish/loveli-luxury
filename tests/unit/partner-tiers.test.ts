/**
 * Tests for the rank display-layer (5 ranks, 1:1 with config_ranks 1..5).
 */

import { describe, expect, it } from 'vitest'
import {
  partnerTierForRank,
  getPartnerTier,
  ALL_PARTNER_TIERS,
} from '../../src/lib/partners/tiers'

describe('partnerTierForRank — 5 ranks map 1:1', () => {
  it('rank 1 → Ambassador', () => {
    expect(partnerTierForRank(1).code).toBe('ambassador')
    expect(partnerTierForRank(1).displayName).toBe('Ambassador')
  })

  it('rank 2 → Executive', () => {
    expect(partnerTierForRank(2).code).toBe('executive')
    expect(partnerTierForRank(2).displayName).toBe('Executive')
  })

  it('rank 3 → Gold Director', () => {
    expect(partnerTierForRank(3).code).toBe('gold_director')
    expect(partnerTierForRank(3).displayName).toBe('Gold Director')
  })

  it('rank 4 → Platinum Director', () => {
    expect(partnerTierForRank(4).code).toBe('platinum_director')
    expect(partnerTierForRank(4).displayName).toBe('Platinum Director')
  })

  it('rank 5 → Crown President', () => {
    expect(partnerTierForRank(5).code).toBe('crown_president')
    expect(partnerTierForRank(5).displayName).toBe('Crown President')
  })

  it('null/undefined/0/-1 collapses to Ambassador (fresh provisioning safe default)', () => {
    expect(partnerTierForRank(null).code).toBe('ambassador')
    expect(partnerTierForRank(undefined).code).toBe('ambassador')
    expect(partnerTierForRank(0).code).toBe('ambassador')
    expect(partnerTierForRank(-1).code).toBe('ambassador')
  })

  it('out-of-band rank position > 5 caps at Crown President', () => {
    expect(partnerTierForRank(6).code).toBe('crown_president')
    expect(partnerTierForRank(99).code).toBe('crown_president')
  })
})

describe('getPartnerTier — direct lookup by position', () => {
  it('returns the right rank for each of 1-5', () => {
    expect(getPartnerTier(1).displayName).toBe('Ambassador')
    expect(getPartnerTier(2).displayName).toBe('Executive')
    expect(getPartnerTier(3).displayName).toBe('Gold Director')
    expect(getPartnerTier(4).displayName).toBe('Platinum Director')
    expect(getPartnerTier(5).displayName).toBe('Crown President')
  })
})

describe('ALL_PARTNER_TIERS', () => {
  it('contains exactly 5 ranks in order', () => {
    expect(ALL_PARTNER_TIERS).toHaveLength(5)
    expect(ALL_PARTNER_TIERS.map((t) => t.position)).toEqual([1, 2, 3, 4, 5])
  })

  it('every rank has a tagline and earning labels', () => {
    for (const tier of ALL_PARTNER_TIERS) {
      expect(tier.tagline.length).toBeGreaterThan(10)
      expect(tier.commissionLabel.length).toBeGreaterThan(0)
      expect(tier.bonusLabel.length).toBeGreaterThan(0)
    }
  })
})
