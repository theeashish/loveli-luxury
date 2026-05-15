'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { previewDraft } from '@/lib/payouts/draft'

const inputSchema = z.object({
  distributorId: z.coerce.number().int().positive(),
  periodYear: z.coerce.number().int().min(2024).max(2099),
  periodMonth: z.coerce.number().int().min(1).max(12),
})

/**
 * Create a payout row in `pending` from the unpaid earnings of a distributor
 * for a given month, then redirect to its detail page.
 *
 * Idempotency: payouts has UNIQUE(distributor_id, period_year, period_month).
 * If one already exists for the chosen period we redirect to it instead of
 * creating a duplicate.
 *
 * Linkage: every commission_ledger / monthly_salary / rank_up_bonus row
 * included in the gross is updated with payout_id pointing back at the new
 * payout. That marks them as "claimed" so a subsequent draft for the same
 * period would find an empty preview.
 */
export async function createPayoutDraft(formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const parsed = inputSchema.safeParse({
    distributorId: formData.get('distributorId'),
    periodYear: formData.get('periodYear'),
    periodMonth: formData.get('periodMonth'),
  })
  if (!parsed.success) throw new Error('Invalid input')
  const { distributorId, periodYear, periodMonth } = parsed.data

  const service = createServiceClient()

  // Short-circuit: if a payout already exists for this period, jump to it.
  const existing = await service
    .from('payouts')
    .select('id')
    .eq('distributor_id', distributorId)
    .eq('period_year', periodYear)
    .eq('period_month', periodMonth)
    .maybeSingle()
  if (existing.data) {
    redirect(`/admin/payouts/${(existing.data as { id: number }).id}`)
  }

  // Pull the distributor's M-Pesa number for the payout row
  const distRes = await service
    .from('distributors')
    .select('id, payout_msisdn')
    .eq('id', distributorId)
    .maybeSingle()
  if (distRes.error || !distRes.data) {
    throw new Error('Distributor not found')
  }
  const dist = distRes.data as { id: number; payout_msisdn: string | null }

  const draft = await previewDraft(distributorId, periodYear, periodMonth)
  if (draft.grossTotalMinor === 0n) {
    throw new Error('Nothing unpaid for this distributor in that period.')
  }

  const ins = await service
    .from('payouts')
    .insert({
      distributor_id: distributorId,
      period_year: periodYear,
      period_month: periodMonth,
      commissions_total_minor: String(draft.commissionsTotalMinor),
      salary_total_minor: String(draft.salaryTotalMinor),
      rank_bonus_total_minor: String(draft.rankBonusTotalMinor),
      retail_profit_minor: 0,
      gross_total_minor: String(draft.grossTotalMinor),
      fees_minor: 0,
      net_total_minor: String(draft.netTotalMinor),
      currency: 'KES',
      payout_method: 'mpesa',
      payout_msisdn: dist.payout_msisdn,
      status: 'pending',
    })
    .select('id')
    .single()
  if (ins.error || !ins.data) {
    throw new Error(`Could not create payout: ${ins.error?.message ?? 'unknown'}`)
  }
  const payoutId = ins.data.id

  // Claim the source rows
  const commissionIds = draft.items.filter((i) => i.type === 'commission').map((i) => i.id)
  const salaryIds = draft.items.filter((i) => i.type === 'salary').map((i) => i.id)
  const bonusIds = draft.items.filter((i) => i.type === 'rank_bonus').map((i) => i.id)
  const adjIds = draft.items.filter((i) => i.type === 'adjustment').map((i) => i.id)

  await Promise.all([
    commissionIds.length
      ? service.from('commission_ledger').update({ payout_id: payoutId }).in('id', commissionIds)
      : Promise.resolve(),
    salaryIds.length
      ? service.from('monthly_salaries').update({ payout_id: payoutId }).in('id', salaryIds)
      : Promise.resolve(),
    bonusIds.length
      ? service.from('rank_up_bonuses').update({ payout_id: payoutId }).in('id', bonusIds)
      : Promise.resolve(),
    adjIds.length
      ? service.from('manual_ledger_adjustments').update({ payout_id: payoutId }).in('id', adjIds)
      : Promise.resolve(),
  ])

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'payout.draft_created',
    resource_type: 'payouts',
    resource_id: String(payoutId),
    after_data: {
      distributor_id: distributorId,
      period_year: periodYear,
      period_month: periodMonth,
      gross_total_minor: String(draft.grossTotalMinor),
    },
  })

  revalidatePath('/admin/payouts')
  redirect(`/admin/payouts/${payoutId}`)
}
