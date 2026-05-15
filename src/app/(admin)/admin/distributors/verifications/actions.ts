'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

const inputSchema = z.object({
  distributorId: z.coerce.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
})

/**
 * Approve or reject a pending payout MSISDN change.
 *
 * approve:
 *   payout_msisdn := pending
 *   payout_msisdn_verified_at := NOW()
 *   payout_msisdn_pending     := NULL
 *   payout_msisdn_pending_at  := NULL
 *
 * reject:
 *   payout_msisdn (unchanged)
 *   payout_msisdn_verified_at (left as-is — note that the distributor
 *                              cleared this when they submitted; admin
 *                              re-stamps it on approval, but on rejection
 *                              the old number remains unverified until a
 *                              future re-submit + approval cycle)
 *   payout_msisdn_pending     := NULL
 *   payout_msisdn_pending_at  := NULL
 *
 * Phase 6 note: rejection leaves the old MSISDN UNVERIFIED. That's by
 * design — once a distributor disowns a number we shouldn't keep firing
 * payouts to it. Admin can manually re-stamp the verification if they
 * confirm the old number is still good (deferred to ops tooling).
 */
export async function decideMsisdnChange(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const parsed = inputSchema.safeParse({
    distributorId: formData.get('distributorId'),
    decision: formData.get('decision'),
  })
  if (!parsed.success) throw new Error('Invalid input')
  const { distributorId, decision } = parsed.data

  const service = createServiceClient()

  const r = await service
    .from('distributors')
    .select(
      'id, payout_msisdn, payout_msisdn_verified_at, payout_msisdn_pending',
    )
    .eq('id', distributorId)
    .maybeSingle()
  const dist = r.data as
    | {
        id: number
        payout_msisdn: string | null
        payout_msisdn_verified_at: string | null
        payout_msisdn_pending: string | null
      }
    | null
  if (!dist) throw new Error('Distributor not found')

  if (!dist.payout_msisdn_pending) {
    throw new Error('No pending change to decide on')
  }

  const before = {
    payout_msisdn: dist.payout_msisdn,
    payout_msisdn_verified_at: dist.payout_msisdn_verified_at,
    payout_msisdn_pending: dist.payout_msisdn_pending,
  }

  if (decision === 'approve') {
    const now = new Date().toISOString()
    const upd = await service
      .from('distributors')
      .update({
        payout_msisdn: dist.payout_msisdn_pending,
        payout_msisdn_verified_at: now,
        payout_msisdn_pending: null,
        payout_msisdn_pending_at: null,
      })
      .eq('id', distributorId)
      .eq('payout_msisdn_pending', dist.payout_msisdn_pending) // optimistic lock
    if (upd.error) throw new Error(upd.error.message)

    await service.from('audit_log').insert({
      actor_id: session.userId,
      action: 'distributor.msisdn_change_approved',
      resource_type: 'distributors',
      resource_id: String(distributorId),
      before_data: before,
      after_data: {
        payout_msisdn: dist.payout_msisdn_pending,
        verified_at: now,
      },
    })
  } else {
    const upd = await service
      .from('distributors')
      .update({
        payout_msisdn_pending: null,
        payout_msisdn_pending_at: null,
      })
      .eq('id', distributorId)
      .eq('payout_msisdn_pending', dist.payout_msisdn_pending)
    if (upd.error) throw new Error(upd.error.message)

    await service.from('audit_log').insert({
      actor_id: session.userId,
      action: 'distributor.msisdn_change_rejected',
      resource_type: 'distributors',
      resource_id: String(distributorId),
      before_data: before,
      after_data: { payout_msisdn_pending: null },
    })
  }

  revalidatePath('/admin/distributors/verifications')
}
