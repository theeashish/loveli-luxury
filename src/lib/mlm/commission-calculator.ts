/**
 * Commission calculator.
 *
 * Pure function: takes inputs, returns ledger entries. No database calls,
 * no network. This makes the function trivially testable against the
 * comp plan worked examples.
 *
 * Caller responsibilities:
 *   1. Load the source distributor's ancestors from `distributor_tree`
 *      where descendant_id = sourceDistributorId AND depth BETWEEN 1 AND 7
 *   2. Load the currently effective commission rates from
 *      `config_commission_rates` WHERE effective_until IS NULL
 *   3. Pass the order's commissionable amount in minor units (sum of
 *      order_items.commissionable_amount_minor for that order)
 *   4. Take the returned entries and INSERT them into `commission_ledger`
 *      in a single transaction with the order status update
 *
 * The function never touches the DB. This guarantees that monthly
 * recalculation, audit replays, and what-if scenarios all use the same code.
 */

import { applyBasisPoints, sumMinor } from '../money'
import type {
  CommissionCalculationInput,
  CommissionCalculationResult,
  CommissionLedgerEntry,
  CommissionRate,
} from './types'

const MAX_DEPTH = 7

export function calculateCommissions(
  input: CommissionCalculationInput
): CommissionCalculationResult {
  const { orderId, sourceDistributorId, commissionableAmountMinor, ancestors, rates } = input

  // No commissionable amount, no commissions
  if (commissionableAmountMinor === 0n) {
    return { entries: [], totalMinor: 0n }
  }

  // Index rates by level for O(1) lookup, ignoring future-dated rows
  const rateByLevel = new Map<number, CommissionRate>()
  for (const rate of rates) {
    rateByLevel.set(rate.level, rate)
  }

  const entries: CommissionLedgerEntry[] = []

  // Sort ancestors by depth ascending so the ledger is written in the
  // same order the comp plan PDF presents them
  const sortedAncestors = [...ancestors]
    .filter((a) => a.depth >= 1 && a.depth <= MAX_DEPTH)
    .sort((a, b) => a.depth - b.depth)

  for (const ancestor of sortedAncestors) {
    const rate = rateByLevel.get(ancestor.depth)
    if (!rate) {
      throw new Error(
        `Missing commission rate for level ${ancestor.depth}. ` +
        `Found rates for levels: [${[...rateByLevel.keys()].sort().join(', ')}]. ` +
        `This indicates an incomplete config_commission_rates table.`
      )
    }

    const amountMinor = applyBasisPoints(commissionableAmountMinor, rate.rateBasisPoints)

    entries.push({
      distributorId: ancestor.distributorId,
      sourceOrderId: orderId,
      sourceDistributorId,
      level: ancestor.depth,
      commissionBasisMinor: commissionableAmountMinor,
      rateBasisPoints: rate.rateBasisPoints,
      amountMinor,
      configCommissionRateId: rate.id,
    })
  }

  return {
    entries,
    totalMinor: sumMinor(entries.map((e) => e.amountMinor)),
  }
}
