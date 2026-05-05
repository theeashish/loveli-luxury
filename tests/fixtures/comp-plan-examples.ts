/**
 * Compensation plan worked examples.
 *
 * Source: Loveli Luxury International Distributor Compensation Plan PDF, pages 7-8.
 * These are the canonical examples. If the implementation produces different
 * numbers, the implementation is wrong, not the fixtures.
 *
 * All amounts in minor units (cents). 1 KES = 100 cents.
 */

import { kesToMinor } from '../../src/lib/money'
import type { CommissionRate, RankConfig, SalaryTier } from '../../src/lib/mlm/types'

// -----------------------------------------------------------------------------
// Active config: the seed values from migration 001
// -----------------------------------------------------------------------------

export const COMMISSION_RATES: CommissionRate[] = [
  { id: 1, level: 1, rateBasisPoints: 2000 },
  { id: 2, level: 2, rateBasisPoints: 900 },
  { id: 3, level: 3, rateBasisPoints: 500 },
  { id: 4, level: 4, rateBasisPoints: 300 },
  { id: 5, level: 5, rateBasisPoints: 200 },
  { id: 6, level: 6, rateBasisPoints: 100 },
  { id: 7, level: 7, rateBasisPoints: 100 },
]

export const RANKS: RankConfig[] = [
  { id: 1, rankPosition: 1, rankName: 'Starter',       minActiveRecruits: 0,   minGroupSalesMinor: kesToMinor(0),         rankUpBonusMinor: kesToMinor(0) },
  { id: 2, rankPosition: 2, rankName: 'Bronze',        minActiveRecruits: 3,   minGroupSalesMinor: kesToMinor(30_000),    rankUpBonusMinor: kesToMinor(2_000) },
  { id: 3, rankPosition: 3, rankName: 'Silver',        minActiveRecruits: 10,  minGroupSalesMinor: kesToMinor(80_000),    rankUpBonusMinor: kesToMinor(5_000) },
  { id: 4, rankPosition: 4, rankName: 'Gold',          minActiveRecruits: 25,  minGroupSalesMinor: kesToMinor(200_000),   rankUpBonusMinor: kesToMinor(15_000) },
  { id: 5, rankPosition: 5, rankName: 'Platinum',      minActiveRecruits: 50,  minGroupSalesMinor: kesToMinor(500_000),   rankUpBonusMinor: kesToMinor(40_000) },
  { id: 6, rankPosition: 6, rankName: 'Diamond',       minActiveRecruits: 100, minGroupSalesMinor: kesToMinor(1_000_000), rankUpBonusMinor: kesToMinor(100_000) },
  { id: 7, rankPosition: 7, rankName: 'Elite Diamond', minActiveRecruits: 200, minGroupSalesMinor: kesToMinor(2_500_000), rankUpBonusMinor: kesToMinor(250_000) },
]

export const SALARY_TIERS: SalaryTier[] = [
  { id: 1, rankPosition: 1, minPersonalBottles: 0,  minTeamGsvMinor: kesToMinor(0),         fixedSalaryMinor: kesToMinor(0),       performanceBonusBasisPoints: 0   },
  { id: 2, rankPosition: 2, minPersonalBottles: 5,  minTeamGsvMinor: kesToMinor(30_000),    fixedSalaryMinor: kesToMinor(2_000),   performanceBonusBasisPoints: 100 },
  { id: 3, rankPosition: 3, minPersonalBottles: 10, minTeamGsvMinor: kesToMinor(80_000),    fixedSalaryMinor: kesToMinor(5_000),   performanceBonusBasisPoints: 150 },
  { id: 4, rankPosition: 4, minPersonalBottles: 20, minTeamGsvMinor: kesToMinor(200_000),   fixedSalaryMinor: kesToMinor(12_000),  performanceBonusBasisPoints: 200 },
  { id: 5, rankPosition: 5, minPersonalBottles: 30, minTeamGsvMinor: kesToMinor(500_000),   fixedSalaryMinor: kesToMinor(25_000),  performanceBonusBasisPoints: 250 },
  { id: 6, rankPosition: 6, minPersonalBottles: 50, minTeamGsvMinor: kesToMinor(1_000_000), fixedSalaryMinor: kesToMinor(60_000),  performanceBonusBasisPoints: 300 },
  { id: 7, rankPosition: 7, minPersonalBottles: 80, minTeamGsvMinor: kesToMinor(2_500_000), fixedSalaryMinor: kesToMinor(120_000), performanceBonusBasisPoints: 350 },
]

// -----------------------------------------------------------------------------
// Package distributor prices (page 2 of the PDF)
// -----------------------------------------------------------------------------

export const PACKAGE_30ML_DISTRIBUTOR_PRICE_MINOR = kesToMinor(4_000)  // 5 bottles × Kes 800
export const PACKAGE_50ML_DISTRIBUTOR_PRICE_MINOR = kesToMinor(7_200)  // 6 bottles × Kes 1,200

// -----------------------------------------------------------------------------
// Per-package commissions (page 3 table)
// -----------------------------------------------------------------------------

/** Commissions a single 30ml package generates at each level, per the PDF */
export const COMMISSIONS_PER_30ML_PACKAGE = {
  level1: kesToMinor(800),   // 20% of 4,000
  level2: kesToMinor(360),   //  9% of 4,000
  level3: kesToMinor(200),   //  5% of 4,000
  level4: kesToMinor(120),   //  3% of 4,000
  level5: kesToMinor(80),    //  2% of 4,000
  level6: kesToMinor(40),    //  1% of 4,000
  level7: kesToMinor(40),    //  1% of 4,000
  total:  kesToMinor(1_640), // sum: 41% of 4,000
}

/** Commissions a single 50ml package generates at each level, per the PDF */
export const COMMISSIONS_PER_50ML_PACKAGE = {
  level1: kesToMinor(1_440),
  level2: kesToMinor(648),
  level3: kesToMinor(360),
  level4: kesToMinor(216),
  level5: kesToMinor(144),
  level6: kesToMinor(72),
  level7: kesToMinor(72),
  total:  kesToMinor(2_952),
}

// -----------------------------------------------------------------------------
// Worked example A — Bronze month 1 (page 7)
// -----------------------------------------------------------------------------

export const EXAMPLE_A_BRONZE_MONTH_1 = {
  description: 'Bronze distributor month 1 from comp plan PDF page 7',
  retailProfit: {
    bottlesSold: 5,
    profitPerBottleKes: 800,
    totalKes: 4_000,
  },
  level1Commissions: {
    recruitsBuyingPackage: 3,
    commissionPerPackageKes: 800,
    totalKes: 2_400,
  },
  monthlySalary: {
    rank: 'Bronze',
    qualified: true,
    fixedKes: 2_000,
    performanceBonusKes: 0,
  },
  totalEarningsKes: 8_400,
  initialInvestmentKes: 4_500,
  netProfitKes: 3_900,
}

// -----------------------------------------------------------------------------
// Worked example B — Gold active month (page 8)
// -----------------------------------------------------------------------------

export const EXAMPLE_B_GOLD_ACTIVE_MONTH = {
  description: 'Gold distributor active month from comp plan PDF page 8',
  retailProfit: {
    bottlesSold: 20,
    profitPerBottleKes: 800,
    totalKes: 16_000,
  },
  networkCommissions: {
    level1: { packagesBought: 5,   commissionPerKes: 800, totalKes:  4_000 },
    level2: { packagesBought: 25,  commissionPerKes: 360, totalKes:  9_000 },
    level3: { packagesBought: 125, commissionPerKes: 200, totalKes: 25_000 },
  },
  monthlySalary: {
    rank: 'Gold',
    qualified: true,
    fixedKes: 12_000,
    teamGsvAchievedKes: 250_000,        // 200k target plus 50k excess
    teamGsvTargetKes:   200_000,
    excessKes: 50_000,
    performanceBonusBasisPoints: 200,
    performanceBonusKes: 1_000,         // 2% × 50,000
  },
  totalEarningsKes: 67_000,
}
