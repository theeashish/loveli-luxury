'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

const inputSchema = z
  .object({
    resolutionId: z.coerce.number().int().positive(),
    decision: z.enum(['written_off', 'deducted_from_payout']),
    deductedFromPayoutId: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) =>
      d.decision !== 'deducted_from_payout' ||
      (d.deductedFromPayoutId !== null && d.deductedFromPayoutId !== undefined),
    {
      message: 'Payout id is required when deducting from a payout.',
      path: ['deductedFromPayoutId'],
    },
  )

/**
 * Record the human decision on a clawback resolution row.
 *
 *   written_off            — accept the loss; no further action.
 *   deducted_from_payout   — note that the amount has been (or will be)
 *                            netted out of a specified payout. Phase 6
 *                            tracks the *intent* only; the actual
 *                            adjustment to that payout's net total is a
 *                            manual ops step (admin re-drafts or edits
 *                            the payout). Phase 7+ may automate.
 */
export async function resolveClawback(formData: FormData): Promise<void> {
  const session = await requireAdmin()

  const parsed = inputSchema.safeParse({
    resolutionId: formData.get('resolutionId'),
    decision: formData.get('decision'),
    deductedFromPayoutId: formData.get('deductedFromPayoutId') || null,
    notes: formData.get('notes') || null,
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')
  }
  const { resolutionId, decision, deductedFromPayoutId, notes } = parsed.data

  const service = createServiceClient()

  const r = await service
    .from('clawback_resolutions')
    .select('id, order_id, resolution')
    .eq('id', resolutionId)
    .maybeSingle()
  if (r.error || !r.data) throw new Error('Resolution row not found')
  const row = r.data as { id: number; order_id: number; resolution: string | null }
  if (row.resolution !== null) {
    throw new Error('This resolution has already been decided')
  }

  // Optional: when the decision references a payout, sanity-check that
  // it actually exists. Cheap defence against typos.
  if (decision === 'deducted_from_payout' && deductedFromPayoutId) {
    const pr = await service
      .from('payouts')
      .select('id')
      .eq('id', deductedFromPayoutId)
      .maybeSingle()
    if (!pr.data) throw new Error(`Payout #${deductedFromPayoutId} not found`)
  }

  const upd = await service
    .from('clawback_resolutions')
    .update({
      resolution: decision,
      deducted_from_payout_id:
        decision === 'deducted_from_payout' ? deductedFromPayoutId ?? null : null,
      notes: notes ?? null,
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', resolutionId)
    .is('resolution', null) // optimistic lock
    .select('id')
    .maybeSingle()
  if (upd.error || !upd.data) {
    throw new Error('Race lost — refresh and retry')
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'clawback.resolved',
    resource_type: 'clawback_resolutions',
    resource_id: String(resolutionId),
    after_data: {
      decision,
      order_id: row.order_id,
      deducted_from_payout_id: deductedFromPayoutId ?? null,
      notes: notes ?? null,
    },
  })

  // For deducted_from_payout decisions, actually move the money — debit
  // the referenced payout's net_total. Phase 5 only tracked intent; this
  // closes the loop. The RPC refuses if the payout is already completed.
  if (decision === 'deducted_from_payout' && deductedFromPayoutId) {
    const applyRes = await service.rpc('apply_clawback_deduction', {
      p_resolution_id: resolutionId,
    })
    if (applyRes.error) {
      throw new Error(
        `Resolution recorded, but auto-deduction failed: ${applyRes.error.message}. ` +
          `Adjust the payout manually before initiating it.`,
      )
    }
    revalidatePath('/admin/payouts')
    revalidatePath(`/admin/payouts/${deductedFromPayoutId}`)
  }

  revalidatePath('/admin/clawbacks')
}
