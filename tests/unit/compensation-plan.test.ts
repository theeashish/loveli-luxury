import { describe, expect, it } from 'vitest'
import { LOVELI_COMPENSATION } from '@/lib/partners/compensation-plan'

describe('attachment-approved Loveli compensation plan', () => {
  it('uses the supplied activation figures', () => {
    expect(LOVELI_COMPENSATION.registrationFeeKes).toBe(100)
    expect(LOVELI_COMPENSATION.activation).toEqual({
      bottles: 5,
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
      'Executive',
      'Gold Director',
      'Platinum Director',
      'Crown President',
    ])
  })
  it('keeps the supplied commission levels and top-rank metrics', () => {
    expect(LOVELI_COMPENSATION.commissionLevels.map((level) => level.percentage)).toEqual([20, 11, 6, 2, 1])
    expect(LOVELI_COMPENSATION.ranks[4]).toMatchObject({
      personalBottles: 60,
      activeDirects: 120,
      activeCustomers: 200,
      groupTargetKes: 7500000,
      rankBonusKes: 300000,
      lifestyleBonusKes: 250000,
    })
  })
})
