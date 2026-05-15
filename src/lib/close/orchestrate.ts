/**
 * Monthly-close orchestration.
 *
 * Two functions, both server-only and idempotent:
 *
 *   runCloseForPeriod(year, month)
 *     For each active distributor, runs compute_gsv_snapshot →
 *     compute_monthly_salary → detect_rank_up. Per-distributor failures
 *     are caught so a single bad row doesn't block the rest of the
 *     batch. Returns aggregate counts.
 *
 *   draftPayoutsForPeriod(year, month, actorId?)
 *     For each active distributor, creates a `pending` payout row from
 *     their unpaid earnings via previewDraft(). Skips distributors who
 *     already have a payout for the period (UNIQUE constraint enforces
 *     that). Returns aggregate counts.
 *
 * Both are called from /admin/close (admin Server Actions) and
 * /api/cron/monthly-close (bearer-secured cron endpoint).
 */

import 'server-only'

import { createServiceClient } from '../supabase/service'
import { previewDraft } from '../payouts/draft'

export type CloseResult = {
  year: number
  month: number
  distributorsTotal: number
  processed: number
  failed: number
  promoted: number
}

export type DraftPayoutsResult = {
  year: number
  month: number
  distributorsTotal: number
  drafted: number
  skippedExisting: number
  skippedZero: number
  failed: number
}

export async function runCloseForPeriod(
  year: number,
  month: number,
  actorId?: string | null,
): Promise<CloseResult> {
  const service = createServiceClient()

  const distRes = await service
    .from('distributors')
    .select('id')
    .eq('is_active', true)
    .order('id')
  if (distRes.error) {
    throw new Error(`distributor lookup failed: ${distRes.error.message}`)
  }
  const distributors = (distRes.data ?? []) as Array<{ id: number }>

  let processed = 0
  let failed = 0
  let promoted = 0

  for (const d of distributors) {
    try {
      const gsv = await service.rpc('compute_gsv_snapshot', {
        p_distributor_id: d.id,
        p_year: year,
        p_month: month,
      })
      if (gsv.error) throw new Error(gsv.error.message)

      const salary = await service.rpc('compute_monthly_salary', {
        p_distributor_id: d.id,
        p_year: year,
        p_month: month,
      })
      if (salary.error) throw new Error(salary.error.message)

      const rankUp = await service.rpc('detect_rank_up', {
        p_distributor_id: d.id,
        p_year: year,
        p_month: month,
      })
      if (rankUp.error) throw new Error(rankUp.error.message)
      if (rankUp.data !== null) promoted += 1

      processed += 1
    } catch {
      failed += 1
    }
  }

  await service.from('audit_log').insert({
    actor_id: actorId ?? null,
    action: 'monthly_close.ran',
    resource_type: 'gsv_snapshots',
    resource_id: `${year}-${String(month).padStart(2, '0')}`,
    after_data: {
      distributors_total: distributors.length,
      processed,
      failed,
      promoted,
    },
  })

  return {
    year,
    month,
    distributorsTotal: distributors.length,
    processed,
    failed,
    promoted,
  }
}

export async function draftPayoutsForPeriod(
  year: number,
  month: number,
  actorId?: string | null,
): Promise<DraftPayoutsResult> {
  const service = createServiceClient()

  const distRes = await service
    .from('distributors')
    .select('id, payout_msisdn')
    .eq('is_active', true)
    .order('id')
  if (distRes.error) {
    throw new Error(`distributor lookup failed: ${distRes.error.message}`)
  }
  const distributors = (distRes.data ?? []) as Array<{
    id: number
    payout_msisdn: string | null
  }>

  let drafted = 0
  let skippedExisting = 0
  let skippedZero = 0
  let failed = 0

  for (const d of distributors) {
    try {
      const existing = await service
        .from('payouts')
        .select('id')
        .eq('distributor_id', d.id)
        .eq('period_year', year)
        .eq('period_month', month)
        .maybeSingle()
      if (existing.data) {
        skippedExisting += 1
        continue
      }

      const draft = await previewDraft(d.id, year, month)
      if (draft.grossTotalMinor === 0n) {
        skippedZero += 1
        continue
      }

      const ins = await service
        .from('payouts')
        .insert({
          distributor_id: d.id,
          period_year: year,
          period_month: month,
          commissions_total_minor: String(draft.commissionsTotalMinor),
          salary_total_minor: String(draft.salaryTotalMinor),
          rank_bonus_total_minor: String(draft.rankBonusTotalMinor),
          retail_profit_minor: 0,
          gross_total_minor: String(draft.grossTotalMinor),
          fees_minor: 0,
          net_total_minor: String(draft.netTotalMinor),
          currency: 'KES',
          payout_method: 'mpesa',
          payout_msisdn: d.payout_msisdn,
          status: 'pending',
        })
        .select('id')
        .single()
      if (ins.error || !ins.data) {
        throw new Error(ins.error?.message ?? 'insert failed')
      }
      const payoutId = ins.data.id

      const commIds = draft.items
        .filter((i) => i.type === 'commission')
        .map((i) => i.id)
      const salaryIds = draft.items
        .filter((i) => i.type === 'salary')
        .map((i) => i.id)
      const bonusIds = draft.items
        .filter((i) => i.type === 'rank_bonus')
        .map((i) => i.id)
      const adjIds = draft.items
        .filter((i) => i.type === 'adjustment')
        .map((i) => i.id)

      await Promise.all([
        commIds.length
          ? service
              .from('commission_ledger')
              .update({ payout_id: payoutId })
              .in('id', commIds)
          : Promise.resolve(),
        salaryIds.length
          ? service
              .from('monthly_salaries')
              .update({ payout_id: payoutId })
              .in('id', salaryIds)
          : Promise.resolve(),
        bonusIds.length
          ? service
              .from('rank_up_bonuses')
              .update({ payout_id: payoutId })
              .in('id', bonusIds)
          : Promise.resolve(),
        adjIds.length
          ? service
              .from('manual_ledger_adjustments')
              .update({ payout_id: payoutId })
              .in('id', adjIds)
          : Promise.resolve(),
      ])

      drafted += 1
    } catch {
      failed += 1
    }
  }

  await service.from('audit_log').insert({
    actor_id: actorId ?? null,
    action: 'monthly_close.payouts_drafted',
    resource_type: 'payouts',
    resource_id: `${year}-${String(month).padStart(2, '0')}`,
    after_data: { drafted, skippedExisting, skippedZero, failed },
  })

  return {
    year,
    month,
    distributorsTotal: distributors.length,
    drafted,
    skippedExisting,
    skippedZero,
    failed,
  }
}

/**
 * "Last full calendar month" in UTC. June 1 → May. Used as the default
 * period when the cron endpoint is invoked without an explicit period.
 */
export function lastFullUtcMonth(now: Date = new Date()): {
  year: number
  month: number
} {
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  ref.setUTCDate(0) // last day of previous month
  return { year: ref.getUTCFullYear(), month: ref.getUTCMonth() + 1 }
}
