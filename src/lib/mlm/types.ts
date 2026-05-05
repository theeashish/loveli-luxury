/**
 * MLM domain types.
 *
 * These mirror the database schema in supabase/migrations/001_initial_schema.sql.
 * Money fields use bigint (minor units, KES cents).
 * Rates use number (basis points, integer).
 */

import type { MinorUnits, BasisPoints } from '../money'

// -----------------------------------------------------------------------------
// Tree
// -----------------------------------------------------------------------------

export interface DistributorAncestor {
  /** The ancestor distributor's id */
  distributorId: number
  /** Depth from the source: 1 = direct sponsor, 7 = top of chain */
  depth: number
}

// -----------------------------------------------------------------------------
// Config (versioned)
// -----------------------------------------------------------------------------

export interface CommissionRate {
  id: number
  level: number          // 1 to 7
  rateBasisPoints: BasisPoints
}

export interface RankConfig {
  id: number
  rankPosition: number   // 1 to 7
  rankName: string
  minActiveRecruits: number
  minGroupSalesMinor: MinorUnits
  rankUpBonusMinor: MinorUnits
}

export interface SalaryTier {
  id: number
  rankPosition: number
  minPersonalBottles: number
  minTeamGsvMinor: MinorUnits
  fixedSalaryMinor: MinorUnits
  performanceBonusBasisPoints: BasisPoints
}

// -----------------------------------------------------------------------------
// Commission calculation
// -----------------------------------------------------------------------------

export interface CommissionCalculationInput {
  /** The order that triggered the commission */
  orderId: number
  /** The distributor who placed (or is sponsor of) the order */
  sourceDistributorId: number
  /** Distributor price of the commissionable items in minor units */
  commissionableAmountMinor: MinorUnits
  /** Pre-fetched ancestors of the source distributor, depth 1-7 only */
  ancestors: DistributorAncestor[]
  /** Currently effective commission rates, one per level */
  rates: CommissionRate[]
}

export interface CommissionLedgerEntry {
  distributorId: number
  sourceOrderId: number
  sourceDistributorId: number
  level: number
  commissionBasisMinor: MinorUnits
  rateBasisPoints: BasisPoints
  amountMinor: MinorUnits
  configCommissionRateId: number
}

export interface CommissionCalculationResult {
  entries: CommissionLedgerEntry[]
  totalMinor: MinorUnits
}

// -----------------------------------------------------------------------------
// Salary qualification
// -----------------------------------------------------------------------------

export interface SalaryCalculationInput {
  rankPosition: number
  personalBottlesSold: number
  teamGsvMinor: MinorUnits
  tier: SalaryTier
}

export interface SalaryCalculationResult {
  qualified: boolean
  failedConditions: string[]
  fixedSalaryMinor: MinorUnits
  performanceBonusMinor: MinorUnits
  totalMinor: MinorUnits
}
