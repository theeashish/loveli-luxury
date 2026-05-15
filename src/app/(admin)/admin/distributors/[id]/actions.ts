'use server'

/**
 * Admin server actions for distributor management.
 *
 *   setDistributorActive — flip is_active. Optimistic-locked against the
 *   current is_active value to avoid double-clicks racing. Audit-logs the
 *   transition; a reason note is mandatory.
 *
 *   createLedgerAdjustment — signed (positive credit / negative debit)
 *   adjustment landing on manual_ledger_adjustments. Phase 7 wave 9.
 *   Included in the next payout draft for the chosen period.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

const setActiveSchema = z.object({
  distributorId: z.coerce.number().int().positive(),
  active: z.enum(['true', 'false']),
  reason: z.string().min(3).max(500),
})

export async function setDistributorActive(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const parsed = setActiveSchema.safeParse({
    distributorId: formData.get('distributorId'),
    active: formData.get('active'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')
  }
  const { distributorId, active, reason } = parsed.data
  const targetActive = active === 'true'

  const service = createServiceClient()

  const r = await service
    .from('distributors')
    .select('id, is_active')
    .eq('id', distributorId)
    .maybeSingle()
  if (r.error || !r.data) throw new Error('Distributor not found')
  const current = r.data as { id: number; is_active: boolean }

  if (current.is_active === targetActive) {
    // No-op — UI raced the database state. Revalidate and return.
    revalidatePath(`/admin/distributors/${distributorId}`)
    revalidatePath('/admin/distributors')
    return
  }

  const upd = await service
    .from('distributors')
    .update({ is_active: targetActive })
    .eq('id', distributorId)
    .eq('is_active', current.is_active) // optimistic lock
    .select('id')
    .maybeSingle()
  if (upd.error || !upd.data) {
    throw new Error('Status changed by another operator — refresh and retry.')
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: targetActive
      ? 'distributor.reactivated'
      : 'distributor.deactivated',
    resource_type: 'distributors',
    resource_id: String(distributorId),
    before_data: { is_active: current.is_active },
    after_data: { is_active: targetActive, reason },
  })

  revalidatePath(`/admin/distributors/${distributorId}`)
  revalidatePath('/admin/distributors')
}

// ---------------------------------------------------------------------------
// createLedgerAdjustment — admin-driven signed credit/debit
// ---------------------------------------------------------------------------

const adjustmentSchema = z.object({
  distributorId: z.coerce.number().int().positive(),
  amountKes: z.coerce.number().int(), // signed; converted to minor below
  periodYear: z.coerce.number().int().min(2024).max(2099),
  periodMonth: z.coerce.number().int().min(1).max(12),
  reason: z.string().min(3).max(2000),
})

export async function createLedgerAdjustment(formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const parsed = adjustmentSchema.safeParse({
    distributorId: formData.get('distributorId'),
    amountKes: formData.get('amountKes'),
    periodYear: formData.get('periodYear'),
    periodMonth: formData.get('periodMonth'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')
  }
  const { distributorId, amountKes, periodYear, periodMonth, reason } =
    parsed.data

  if (amountKes === 0) {
    throw new Error('Adjustment amount cannot be zero.')
  }

  const service = createServiceClient()

  // Sanity-check the distributor exists before we write.
  const distRes = await service
    .from('distributors')
    .select('id')
    .eq('id', distributorId)
    .maybeSingle()
  if (distRes.error || !distRes.data) throw new Error('Distributor not found')

  const amountMinor = amountKes * 100 // KES → minor, signed
  const ins = await service
    .from('manual_ledger_adjustments')
    .insert({
      distributor_id: distributorId,
      amount_minor: amountMinor,
      currency: 'KES',
      period_year: periodYear,
      period_month: periodMonth,
      reason,
      actor_id: session.userId,
    })
    .select('id')
    .single()
  if (ins.error || !ins.data) {
    throw new Error(`Adjustment failed: ${ins.error?.message ?? 'unknown'}`)
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: amountMinor >= 0 ? 'ledger.adjustment_credit' : 'ledger.adjustment_debit',
    resource_type: 'manual_ledger_adjustments',
    resource_id: String(ins.data.id),
    after_data: {
      distributor_id: distributorId,
      amount_minor: amountMinor,
      period_year: periodYear,
      period_month: periodMonth,
      reason,
    },
  })

  revalidatePath(`/admin/distributors/${distributorId}`)
}
