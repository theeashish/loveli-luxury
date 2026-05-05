/**
 * Monthly salary calculator.
 *
 * Two-condition qualification per comp plan PDF page 5:
 *   1. Personal sales: minimum bottles personally sold this month
 *   2. Team sales: minimum GSV (Group Sales Volume) across full downline
 *
 * If both met: pay fixed salary + (performance bonus % × excess GSV).
 * If either fails: zero salary, zero bonus, no carry-forward.
 *
 * Pure function. Caller loads inputs from gsv_snapshots and config_salary_tiers.
 */

import { applyBasisPoints } from '../money'
import type { SalaryCalculationInput, SalaryCalculationResult } from './types'

export function calculateMonthlySalary(
  input: SalaryCalculationInput
): SalaryCalculationResult {
  const { personalBottlesSold, teamGsvMinor, tier } = input

  const failedConditions: string[] = []

  if (personalBottlesSold < tier.minPersonalBottles) {
    failedConditions.push(
      `Personal sales: ${personalBottlesSold} bottles, requires ${tier.minPersonalBottles}`
    )
  }

  if (teamGsvMinor < tier.minTeamGsvMinor) {
    failedConditions.push(
      `Team GSV: ${teamGsvMinor} cents, requires ${tier.minTeamGsvMinor} cents`
    )
  }

  if (failedConditions.length > 0) {
    return {
      qualified: false,
      failedConditions,
      fixedSalaryMinor: 0n,
      performanceBonusMinor: 0n,
      totalMinor: 0n,
    }
  }

  // Performance bonus: % of excess above team target
  const excessMinor = teamGsvMinor - tier.minTeamGsvMinor
  const performanceBonusMinor = excessMinor > 0n
    ? applyBasisPoints(excessMinor, tier.performanceBonusBasisPoints)
    : 0n

  return {
    qualified: true,
    failedConditions: [],
    fixedSalaryMinor: tier.fixedSalaryMinor,
    performanceBonusMinor,
    totalMinor: tier.fixedSalaryMinor + performanceBonusMinor,
  }
}
