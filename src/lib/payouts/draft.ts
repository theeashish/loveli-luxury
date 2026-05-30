/**
 * Payout drafting helpers.
 *
 * A payout is a snapshot of all unpaid earnings owed to a distributor for a
 * given (year, month) period. We sum:
 *   - unpaid commission_ledger rows
 *   - unpaid monthly_salaries (one per period)
 *   - unpaid rank_up_bonuses
 *
 * Phase 3: no Flutterwave fee modelling. fees = 0; net = gross.
 *
 * The functions here are server-only and assume the caller has already
 * verified admin role.
 */

import 'server-only'

import { createServiceClient } from '../supabase/service'

export type DraftItem = {
  type: 'commission' | 'salary' | 'rank_bonus' | 'adjustment'
  id: number
  amount_minor: bigint
  label: string
}

export type DraftPreview = {
  distributorId: number
  periodYear: number
  periodMonth: number
  commissionsTotalMinor: bigint
  salaryTotalMinor: bigint
  rankBonusTotalMinor: bigint
  grossTotalMinor: bigint
  netTotalMinor: bigint
  items: DraftItem[]
}

/**
 * Compute the unpaid totals for a distributor in a given period.
 *
 * "Unpaid" means payout_id IS NULL on the ledger / salary / bonus row. We
 * scope commission_ledger by `earned_at` falling within the calendar month;
 * salaries and bonuses key on their own period columns where applicable.
 */
export async function previewDraft(
  distributorId: number,
  periodYear: number,
  periodMonth: number,
): Promise<DraftPreview> {
  const service = createServiceClient()

  // Calendar window for commission earned_at
  const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1))
  const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 1))

  const [commRes, salaryRes, bonusRes, adjRes] = await Promise.all([
    service
      .from('commission_ledger')
      .select('id, amount_minor, level, source_order_id, earned_at')
      .eq('distributor_id', distributorId)
      .is('payout_id', null)
      .gte('earned_at', periodStart.toISOString())
      .lt('earned_at', periodEnd.toISOString())
      .order('earned_at'),
    service
      .from('monthly_salaries')
      .select('id, total_minor, period_year, period_month')
      .eq('distributor_id', distributorId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .is('payout_id', null),
    service
      .from('rank_up_bonuses')
      .select('id, amount_minor, rank_id, awarded_at')
      .eq('distributor_id', distributorId)
      .is('payout_id', null)
      .gte('awarded_at', periodStart.toISOString())
      .lt('awarded_at', periodEnd.toISOString()),
    service
      .from('manual_ledger_adjustments')
      .select('id, amount_minor, reason, period_year, period_month')
      .eq('distributor_id', distributorId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .is('payout_id', null),
  ])

  if (commRes.error) throw new Error(`commission lookup: ${commRes.error.message}`)
  if (salaryRes.error) throw new Error(`salary lookup: ${salaryRes.error.message}`)
  if (bonusRes.error) throw new Error(`bonus lookup: ${bonusRes.error.message}`)
  if (adjRes.error) throw new Error(`adjustment lookup: ${adjRes.error.message}`)

  const items: DraftItem[] = []
  let commissionsTotal = 0n
  let salaryTotal = 0n
  let rankBonusTotal = 0n

  for (const c of (commRes.data ?? []) as Array<{
    id: number
    amount_minor: string | number
    level: number
    source_order_id: number
  }>) {
    const a = BigInt(c.amount_minor)
    commissionsTotal += a
    items.push({
      type: 'commission',
      id: c.id,
      amount_minor: a,
      label: `L${c.level} commission · order #${c.source_order_id}`,
    })
  }
  for (const s of (salaryRes.data ?? []) as Array<{
    id: number
    total_minor: string | number
  }>) {
    const a = BigInt(s.total_minor)
    salaryTotal += a
    items.push({ type: 'salary', id: s.id, amount_minor: a, label: 'Monthly salary' })
  }
  for (const b of (bonusRes.data ?? []) as Array<{
    id: number
    amount_minor: string | number
    rank_id: number
  }>) {
    const a = BigInt(b.amount_minor)
    rankBonusTotal += a
    items.push({
      type: 'rank_bonus',
      id: b.id,
      amount_minor: a,
      label: `Rank-up bonus · rank #${b.rank_id}`,
    })
  }
  // Manual ledger adjustments — signed (positive = credit, negative = debit).
  // We add them to commissions for the purpose of the draft total; the gross
  // can drop below other component sums if the net adjustment is negative.
  for (const m of (adjRes.data ?? []) as Array<{
    id: number
    amount_minor: string | number
    reason: string
  }>) {
    const a = BigInt(m.amount_minor)
    commissionsTotal += a
    items.push({
      type: 'adjustment',
      id: m.id,
      amount_minor: a,
      label: `Manual adjustment · ${m.reason.slice(0, 60)}${
        m.reason.length > 60 ? '…' : ''
      }`,
    })
  }

  const grossTotal = commissionsTotal + salaryTotal + rankBonusTotal
  // Phase 3: no fees modelled. Net == gross. Fees_minor stays 0 in the row.
  const netTotal = grossTotal

  return {
    distributorId,
    periodYear,
    periodMonth,
    commissionsTotalMinor: commissionsTotal,
    salaryTotalMinor: salaryTotal,
    rankBonusTotalMinor: rankBonusTotal,
    grossTotalMinor: grossTotal,
    netTotalMinor: netTotal,
    items,
  }
}
