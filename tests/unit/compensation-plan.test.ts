import { describe, expect, it } from 'vitest'
import { LOVELI_COMPENSATION } from '@/lib/partners/compensation-plan'

describe('attachment-approved Loveli compensation plan', () => {
  it('uses the supplied product and registration figures', () => {
    expect(LOVELI_COMPENSATION.registrationFeeKes).toBe(900)
    expect(LOVELI_COMPENSATION.product).toEqual({
      sizeMl: 50,
      iboPriceKes: 1000,
      suggestedRetailKes: 2500,
      retailProfitKes: 1500,
      pv: 500,
    })
  })
  it('keeps the five ranks in the supplied order', () => {
    expect(LOVELI_COMPENSATION.ranks.map((rank) => rank.name)).toEqual([
      'Ambassador',
      'Active',
      'Gold Director',
      'Platinum Director',
      'Crown President',
    ])
  })
  it('keeps the supplied commission levels and top-rank metrics', () => {
    expect(LOVELI_COMPENSATION.commissionLevels.map((level) => level.percentage)).toEqual([20, 11, 6, 2, 1])
    expect(LOVELI_COMPENSATION.ranks[4]).toMatchObject({
      personalBottles: 100,
      activeDirects: 120,
      groupTargetKes: 8500000,
      rankBonusKes: 300000,
      lifestyleBonusKes: 250000,
    })
  })
})
