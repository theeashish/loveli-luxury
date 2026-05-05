import { describe, it, expect } from 'vitest'
import { calculateMonthlySalary } from '../../src/lib/mlm/salary-calculator'
import { kesToMinor } from '../../src/lib/money'
import { SALARY_TIERS, EXAMPLE_B_GOLD_ACTIVE_MONTH } from '../fixtures/comp-plan-examples'

describe('calculateMonthlySalary', () => {
  const goldTier = SALARY_TIERS.find((t) => t.rankPosition === 4)!
  const bronzeTier = SALARY_TIERS.find((t) => t.rankPosition === 2)!

  it('Bronze qualifies with exactly 5 bottles + Kes 30k GSV → Kes 2,000 salary', () => {
    const result = calculateMonthlySalary({
      rankPosition: 2,
      personalBottlesSold: 5,
      teamGsvMinor: kesToMinor(30_000),
      tier: bronzeTier,
    })
    expect(result.qualified).toBe(true)
    expect(result.fixedSalaryMinor).toBe(kesToMinor(2_000))
    expect(result.performanceBonusMinor).toBe(0n)
    expect(result.totalMinor).toBe(kesToMinor(2_000))
  })

  it('Bronze fails with 4 bottles even if GSV met → zero salary', () => {
    const result = calculateMonthlySalary({
      rankPosition: 2,
      personalBottlesSold: 4,
      teamGsvMinor: kesToMinor(50_000),
      tier: bronzeTier,
    })
    expect(result.qualified).toBe(false)
    expect(result.totalMinor).toBe(0n)
    expect(result.failedConditions[0]).toMatch(/personal sales/i)
  })

  it('Bronze fails with low GSV even if bottles met → zero salary', () => {
    const result = calculateMonthlySalary({
      rankPosition: 2,
      personalBottlesSold: 10,
      teamGsvMinor: kesToMinor(20_000),
      tier: bronzeTier,
    })
    expect(result.qualified).toBe(false)
    expect(result.totalMinor).toBe(0n)
    expect(result.failedConditions[0]).toMatch(/team gsv/i)
  })

  it('Both conditions failing returns both messages', () => {
    const result = calculateMonthlySalary({
      rankPosition: 2,
      personalBottlesSold: 1,
      teamGsvMinor: kesToMinor(1_000),
      tier: bronzeTier,
    })
    expect(result.failedConditions).toHaveLength(2)
  })

  it('PDF Example B: Gold worked example produces Kes 13,000 salary + bonus', () => {
    // Gold tier: 20 bottles, Kes 200k GSV, Kes 12k salary, 2% bonus
    // Example: 20 bottles personally + Kes 250k team = Kes 50k excess
    // Bonus: 2% × 50k = Kes 1,000. Total: Kes 12,000 + 1,000 = Kes 13,000
    const e = EXAMPLE_B_GOLD_ACTIVE_MONTH

    const result = calculateMonthlySalary({
      rankPosition: 4,
      personalBottlesSold: 20,
      teamGsvMinor: kesToMinor(e.monthlySalary.teamGsvAchievedKes),
      tier: goldTier,
    })

    expect(result.qualified).toBe(true)
    expect(result.fixedSalaryMinor).toBe(kesToMinor(e.monthlySalary.fixedKes))
    expect(result.performanceBonusMinor).toBe(kesToMinor(e.monthlySalary.performanceBonusKes))
    expect(result.totalMinor).toBe(kesToMinor(13_000))
  })

  it('Hitting target exactly produces zero performance bonus (no excess)', () => {
    const result = calculateMonthlySalary({
      rankPosition: 4,
      personalBottlesSold: 20,
      teamGsvMinor: kesToMinor(200_000),
      tier: goldTier,
    })
    expect(result.qualified).toBe(true)
    expect(result.performanceBonusMinor).toBe(0n)
    expect(result.totalMinor).toBe(kesToMinor(12_000))
  })
})
