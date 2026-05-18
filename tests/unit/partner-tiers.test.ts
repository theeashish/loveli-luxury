/**
 * Tests for the Phase-1 rank→tier display-layer bridge.
 */

import { describe, expect, it } from 'vitest'
import {
  partnerTierForRank,
  getPartnerTier,
  ALL_PARTNER_TIERS,
} from '../../src/lib/partners/tiers'

describe('partnerTierForRank — 8 internal ranks bucket into 4 customer tiers', () => {
  it('rank 1 (Team Builder) → Concierge Partner', () => {
    expect(partnerTierForRank(1).code).toBe('concierge_partner')
    expect(partnerTierForRank(1).displayName).toBe('Concierge Partner')
  })

  it('rank 2 (Team Leader) → Concierge Partner', () => {
    expect(partnerTierForRank(2).code).toBe('concierge_partner')
  })

  it('rank 3 (Supervisor) → Brand Associate', () => {
    expect(partnerTierForRank(3).code).toBe('brand_associate')
    expect(partnerTierForRank(3).displayName).toBe('Brand Associate')
  })

  it('rank 4 (Manager) → Brand Associate', () => {
    expect(partnerTierForRank(4).code).toBe('brand_associate')
  })

  it('rank 5 (Senior Manager) → Regional Curator', () => {
    expect(partnerTierForRank(5).code).toBe('regional_curator')
    expect(partnerTierForRank(5).displayName).toBe('Regional Curator')
  })

  it('rank 6 (Executive Manager) → Regional Curator', () => {
    expect(partnerTierForRank(6).code).toBe('regional_curator')
  })

  it('rank 7 (Legacy Builder) → Prestige Partner', () => {
    expect(partnerTierForRank(7).code).toBe('prestige_partner')
    expect(partnerTierForRank(7).displayName).toBe('Prestige Partner')
  })

  it('rank 8 (Ambassador) → Prestige Partner', () => {
    expect(partnerTierForRank(8).code).toBe('prestige_partner')
  })

  it('null/undefined/0 collapses to Concierge Partner (fresh provisioning safe default)', () => {
    expect(partnerTierForRank(null).code).toBe('concierge_partner')
    expect(partnerTierForRank(undefined).code).toBe('concierge_partner')
    expect(partnerTierForRank(0).code).toBe('concierge_partner')
    expect(partnerTierForRank(-1).code).toBe('concierge_partner')
  })

  it('out-of-band rank position > 8 collapses to Prestige Partner', () => {
    expect(partnerTierForRank(9).code).toBe('prestige_partner')
    expect(partnerTierForRank(99).code).toBe('prestige_partner')
  })
})

describe('getPartnerTier — direct lookup by tier position', () => {
  it('returns the right tier for each of 1-4', () => {
    expect(getPartnerTier(1).displayName).toBe('Concierge Partner')
    expect(getPartnerTier(2).displayName).toBe('Brand Associate')
    expect(getPartnerTier(3).displayName).toBe('Regional Curator')
    expect(getPartnerTier(4).displayName).toBe('Prestige Partner')
  })
})

describe('ALL_PARTNER_TIERS', () => {
  it('contains exactly 4 tiers in order', () => {
    expect(ALL_PARTNER_TIERS).toHaveLength(4)
    expect(ALL_PARTNER_TIERS.map((t) => t.position)).toEqual([1, 2, 3, 4])
  })

  it('every tier has a tagline and a direct rate label', () => {
    for (const tier of ALL_PARTNER_TIERS) {
      expect(tier.tagline.length).toBeGreaterThan(10)
      expect(tier.directRateLabel.length).toBeGreaterThan(0)
      expect(tier.overrideLabel.length).toBeGreaterThan(0)
    }
  })
})
