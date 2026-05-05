/**
 * Commission calculator tests.
 *
 * Test fixtures are the worked examples from the comp plan PDF.
 * If any of these fail, the implementation is wrong.
 */

import { describe, it, expect } from 'vitest'
import { calculateCommissions } from '../../src/lib/mlm/commission-calculator'
import { kesToMinor, applyBasisPoints, sumMinor } from '../../src/lib/money'
import {
  COMMISSION_RATES,
  PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
  PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR,
  COMMISSIONS_PER_30ML_PACKAGE,
  COMMISSIONS_PER_50ML_PACKAGE,
  EXAMPLE_A_BRONZE_MONTH_1,
  EXAMPLE_B_GOLD_ACTIVE_MONTH,
} from '../fixtures/comp-plan-examples'
import type { DistributorAncestor } from '../../src/lib/mlm/types'

// -----------------------------------------------------------------------------
// Per-level commission amounts (page 3 of the PDF)
// -----------------------------------------------------------------------------

describe('Commission rates produce the per-package amounts in the PDF', () => {
  it('30ml package level 1 = Kes 800 (20% of Kes 4,000)', () => {
    expect(applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 2000))
      .toBe(COMMISSIONS_PER_30ML_PACKAGE.level1)
  })

  it('30ml package level 2 = Kes 360 (9% of Kes 4,000)', () => {
    expect(applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 900))
      .toBe(COMMISSIONS_PER_30ML_PACKAGE.level2)
  })

  it('30ml package level 3 = Kes 200 (5% of Kes 4,000)', () => {
    expect(applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 500))
      .toBe(COMMISSIONS_PER_30ML_PACKAGE.level3)
  })

  it('30ml package total commission across 7 levels = Kes 1,640 (41%)', () => {
    const total = sumMinor([
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 2000),
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 900),
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 500),
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 300),
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 200),
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 100),
      applyBasisPoints(PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR, 100),
    ])
    expect(total).toBe(COMMISSIONS_PER_30ML_PACKAGE.total)
  })

  it('50ml package total commission across 7 levels = Kes 2,952 (41%)', () => {
    const total = sumMinor([
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 2000),
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 900),
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 500),
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 300),
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 200),
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 100),
      applyBasisPoints(PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR, 100),
    ])
    expect(total).toBe(COMMISSIONS_PER_50ML_PACKAGE.total)
  })
})

// -----------------------------------------------------------------------------
// calculateCommissions: core function
// -----------------------------------------------------------------------------

describe('calculateCommissions', () => {
  it('emits one ledger entry per ancestor at depth 1-7', () => {
    const ancestors: DistributorAncestor[] = [
      { distributorId: 1001, depth: 1 },
      { distributorId: 1002, depth: 2 },
      { distributorId: 1003, depth: 3 },
    ]

    const result = calculateCommissions({
      orderId: 1,
      sourceDistributorId: 1004,
      commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
      ancestors,
      rates: COMMISSION_RATES,
    })

    expect(result.entries).toHaveLength(3)
    expect(result.entries[0]?.distributorId).toBe(1001)
    expect(result.entries[0]?.level).toBe(1)
    expect(result.entries[1]?.distributorId).toBe(1002)
    expect(result.entries[1]?.level).toBe(2)
  })

  it('30ml package with 7 ancestors produces the comp plan amounts at every level', () => {
    const ancestors: DistributorAncestor[] = Array.from({ length: 7 }, (_, i) => ({
      distributorId: 1000 + i + 1,
      depth: i + 1,
    }))

    const result = calculateCommissions({
      orderId: 1,
      sourceDistributorId: 9999,
      commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
      ancestors,
      rates: COMMISSION_RATES,
    })

    expect(result.entries).toHaveLength(7)
    expect(result.entries[0]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level1)
    expect(result.entries[1]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level2)
    expect(result.entries[2]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level3)
    expect(result.entries[3]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level4)
    expect(result.entries[4]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level5)
    expect(result.entries[5]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level6)
    expect(result.entries[6]?.amountMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.level7)
    expect(result.totalMinor).toBe(COMMISSIONS_PER_30ML_PACKAGE.total)
  })

  it('drops ancestors beyond depth 7 silently', () => {
    const ancestors: DistributorAncestor[] = Array.from({ length: 10 }, (_, i) => ({
      distributorId: 1000 + i + 1,
      depth: i + 1,
    }))

    const result = calculateCommissions({
      orderId: 1,
      sourceDistributorId: 9999,
      commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
      ancestors,
      rates: COMMISSION_RATES,
    })

    // Should only pay 7 levels even though 10 ancestors were passed
    expect(result.entries).toHaveLength(7)
  })

  it('handles partial chains for new tree branches', () => {
    // Distributor near the top with only 2 ancestors
    const ancestors: DistributorAncestor[] = [
      { distributorId: 1, depth: 1 },
      { distributorId: 2, depth: 2 },
    ]

    const result = calculateCommissions({
      orderId: 1,
      sourceDistributorId: 100,
      commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
      ancestors,
      rates: COMMISSION_RATES,
    })

    expect(result.entries).toHaveLength(2)
    expect(result.totalMinor).toBe(
      COMMISSIONS_PER_30ML_PACKAGE.level1 + COMMISSIONS_PER_30ML_PACKAGE.level2
    )
  })

  it('returns zero ledger entries when commissionable amount is zero', () => {
    const ancestors: DistributorAncestor[] = [
      { distributorId: 1, depth: 1 },
    ]

    const result = calculateCommissions({
      orderId: 1,
      sourceDistributorId: 100,
      commissionableAmountMinor: 0n,
      ancestors,
      rates: COMMISSION_RATES,
    })

    expect(result.entries).toHaveLength(0)
    expect(result.totalMinor).toBe(0n)
  })

  it('throws when a required level is missing from rates config', () => {
    const ancestors: DistributorAncestor[] = [
      { distributorId: 1, depth: 1 },
      { distributorId: 2, depth: 2 },
    ]

    const incompleteRates = COMMISSION_RATES.filter((r) => r.level !== 2)

    expect(() =>
      calculateCommissions({
        orderId: 1,
        sourceDistributorId: 100,
        commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
        ancestors,
        rates: incompleteRates,
      })
    ).toThrow(/missing commission rate for level 2/i)
  })

  it('records the source order, source distributor, and rate config id on every entry', () => {
    const ancestors: DistributorAncestor[] = [
      { distributorId: 42, depth: 1 },
    ]

    const result = calculateCommissions({
      orderId: 7777,
      sourceDistributorId: 8888,
      commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
      ancestors,
      rates: COMMISSION_RATES,
    })

    expect(result.entries[0]?.sourceOrderId).toBe(7777)
    expect(result.entries[0]?.sourceDistributorId).toBe(8888)
    expect(result.entries[0]?.configCommissionRateId).toBe(1)
  })
})

// -----------------------------------------------------------------------------
// PDF Example A: Bronze month 1
// -----------------------------------------------------------------------------

describe('Example A: Bronze distributor month 1 (PDF page 7)', () => {
  const e = EXAMPLE_A_BRONZE_MONTH_1

  it('retail profit on 5 × 30ml bottles = Kes 4,000', () => {
    const profitPerBottle = kesToMinor(e.retailProfit.profitPerBottleKes)
    const totalProfit = profitPerBottle * BigInt(e.retailProfit.bottlesSold)
    expect(totalProfit).toBe(kesToMinor(e.retailProfit.totalKes))
  })

  it('level 1 commissions on 3 recruits buying 30ml package = Kes 2,400', () => {
    const ancestors: DistributorAncestor[] = [{ distributorId: 1, depth: 1 }]

    let totalLevel1 = 0n
    for (let i = 0; i < e.level1Commissions.recruitsBuyingPackage; i++) {
      const result = calculateCommissions({
        orderId: i + 1,
        sourceDistributorId: 100 + i,
        commissionableAmountMinor: PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR,
        ancestors,
        rates: COMMISSION_RATES,
      })
      totalLevel1 += result.totalMinor
    }

    expect(totalLevel1).toBe(kesToMinor(e.level1Commissions.totalKes))
  })

  it('total month 1 earnings = Kes 8,400', () => {
    const retailProfitMinor = kesToMinor(e.retailProfit.totalKes)
    const level1TotalMinor = kesToMinor(e.level1Commissions.totalKes)
    const salaryMinor = kesToMinor(e.monthlySalary.fixedKes)
    const total = retailProfitMinor + level1TotalMinor + salaryMinor
    expect(total).toBe(kesToMinor(e.totalEarningsKes))
  })

  it('net profit after Kes 4,500 initial investment = Kes 3,900', () => {
    const totalEarnings = kesToMinor(e.totalEarningsKes)
    const investment = kesToMinor(e.initialInvestmentKes)
    const net = totalEarnings - investment
    expect(net).toBe(kesToMinor(e.netProfitKes))
  })
})

// -----------------------------------------------------------------------------
// PDF Example B: Gold active month
// -----------------------------------------------------------------------------

describe('Example B: Gold distributor active month (PDF page 8)', () => {
  const e = EXAMPLE_B_GOLD_ACTIVE_MONTH

  it('retail profit on 20 × 30ml bottles = Kes 16,000', () => {
    const profitPerBottle = kesToMinor(e.retailProfit.profitPerBottleKes)
    const totalProfit = profitPerBottle * BigInt(e.retailProfit.bottlesSold)
    expect(totalProfit).toBe(kesToMinor(e.retailProfit.totalKes))
  })

  it('level 1 commission for 5 packages = Kes 4,000', () => {
    const expected = kesToMinor(e.networkCommissions.level1.totalKes)
    const computed = COMMISSIONS_PER_30ML_PACKAGE.level1 * BigInt(e.networkCommissions.level1.packagesBought)
    expect(computed).toBe(expected)
  })

  it('level 2 commission for 25 packages = Kes 9,000', () => {
    const expected = kesToMinor(e.networkCommissions.level2.totalKes)
    const computed = COMMISSIONS_PER_30ML_PACKAGE.level2 * BigInt(e.networkCommissions.level2.packagesBought)
    expect(computed).toBe(expected)
  })

  it('level 3 commission for 125 packages = Kes 25,000', () => {
    const expected = kesToMinor(e.networkCommissions.level3.totalKes)
    const computed = COMMISSIONS_PER_30ML_PACKAGE.level3 * BigInt(e.networkCommissions.level3.packagesBought)
    expect(computed).toBe(expected)
  })

  it('performance bonus 2% × Kes 50,000 excess = Kes 1,000', () => {
    const excess = kesToMinor(e.monthlySalary.excessKes)
    const bonus = applyBasisPoints(excess, e.monthlySalary.performanceBonusBasisPoints)
    expect(bonus).toBe(kesToMinor(e.monthlySalary.performanceBonusKes))
  })

  it('total monthly earnings = Kes 67,000', () => {
    const retail = kesToMinor(e.retailProfit.totalKes)
    const l1 = kesToMinor(e.networkCommissions.level1.totalKes)
    const l2 = kesToMinor(e.networkCommissions.level2.totalKes)
    const l3 = kesToMinor(e.networkCommissions.level3.totalKes)
    const salary = kesToMinor(e.monthlySalary.fixedKes)
    const bonus = kesToMinor(e.monthlySalary.performanceBonusKes)
    const total = retail + l1 + l2 + l3 + salary + bonus
    expect(total).toBe(kesToMinor(e.totalEarningsKes))
  })
})
