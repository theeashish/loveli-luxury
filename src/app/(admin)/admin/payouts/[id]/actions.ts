'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getServerEnv } from '@/lib/env'

const idSchema = z.object({
  payoutId: z.coerce.number().int().positive(),
})

/**
 * Initiate an M-Pesa B2C transfer for a `pending` payout.
 *
 * Steps:
 *   1. ENABLE_PAYOUTS feature gate.
 *   2. Verify the distributor's MSISDN is still verified and unchanged
 *      since the payout was drafted.
 *   3. Optimistically lock the row by transitioning status pending →
 *      processing with `.eq('status', 'pending')`. If another caller
 *      beat us, abort.
 *   4. Call the provider's B2C transfer API. Phase 0 (2026-06-03)
 *      throws — IntaSend payouts are wired in Phase 4.
 *   5. On API success, store the provider tracking id on the row and
 *      stamp `initiated_at`. On API failure, roll status back to
 *      `pending` so the admin can retry.
 *   6. The terminal status (completed / failed) is set by the webhook.
 */
export async function initiatePayout(formData: FormData): Promise<void> {
  const env = getServerEnv()
  if (!env.ENABLE_PAYOUTS) {
    throw new Error('Payouts are disabled. Set ENABLE_PAYOUTS=true to proceed.')
  }

  const session = await requireAdmin()
  const parsed = idSchema.safeParse({ payoutId: formData.get('payoutId') })
  if (!parsed.success) throw new Error('Invalid payout id')
  const { payoutId } = parsed.data

  const service = createServiceClient()

  const r = await service
    .from('payouts')
    .select(
      'id, distributor_id, status, net_total_minor, payout_msisdn, period_year, period_month',
    )
    .eq('id', payoutId)
    .maybeSingle()
  if (r.error || !r.data) throw new Error('Payout not found')
  const row = r.data as {
    id: number
    distributor_id: number
    status: string
    net_total_minor: string | number
    payout_msisdn: string | null
    period_year: number
    period_month: number
  }

  if (!row.payout_msisdn) {
    throw new Error('Distributor has no verified M-Pesa number on file.')
  }

  // Phase 5 hardening: refuse to fire a payout to an unverified MSISDN.
  // provision_distributor stamps payout_msisdn_verified_at at signup-time
  // (the successful M-Pesa charge for the starter package serves as the
  // initial verification). A distributor whose number was later changed
  // must be re-verified before a payout can fire.
  const distVerify = await service
    .from('distributors')
    .select('payout_msisdn_verified_at, payout_msisdn')
    .eq('id', row.distributor_id)
    .maybeSingle()
  const dv = distVerify.data as
    | { payout_msisdn_verified_at: string | null; payout_msisdn: string | null }
    | null
  if (!dv || !dv.payout_msisdn_verified_at) {
    throw new Error(
      "Distributor's M-Pesa number is not verified. " +
        'Verify before initiating the payout.',
    )
  }
  if (dv.payout_msisdn !== row.payout_msisdn) {
    throw new Error(
      'Distributor MSISDN has changed since this payout was drafted. ' +
        'Re-verify the new number, then re-draft the payout.',
    )
  }

  // Optimistic lock — only one caller may flip pending → processing
  const lockRes = await service
    .from('payouts')
    .update({ status: 'processing', initiated_at: new Date().toISOString() })
    .eq('id', payoutId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()
  if (lockRes.error || !lockRes.data) {
    throw new Error('Payout is not in pending state.')
  }

  // amountKes is computed by Phase 4's real implementation (commented below).
  // Touch it here so the variable is in scope for the commented future code
  // without tripping noUnusedLocals.
  void Number(BigInt(row.net_total_minor) / 100n)

  try {
    // Phase 0 (2026-06-03): IntaSend B2C payout dispatch is not yet
    // wired (lands in Phase 4 of the migration). Roll the row back to
    // pending and surface a clear error so admin tooling doesn't
    // silently mark a payout "processing" that no provider will ever
    // settle.
    throw new Error(
      'IntaSend B2C payout dispatch is not yet wired. Phase 4 of the PayHero → IntaSend migration adds the real implementation; until then, no payouts fire.',
    )

    // Phase 4 implementation will look like:
    //   const tracking = await initiateIntasendB2C({
    //     amountKes, msisdn: row.payout_msisdn, payoutId, ...
    //   })
    //   await service.from('payouts').update({
    //     provider:    'intasend',
    //     tracking_id: tracking.id,
    //     account:     row.payout_msisdn,
    //     raw_payload: tracking.raw,
    //   }).eq('id', payoutId)
    //   await service.from('audit_log').insert({
    //     actor_id:      session.userId,
    //     action:        'payout.initiated',
    //     resource_type: 'payouts',
    //     resource_id:   String(payoutId),
    //     after_data: {
    //       provider: 'intasend', tracking_id: tracking.id,
    //       amount_kes: amountKes, msisdn: row.payout_msisdn,
    //     },
    //   })
  } catch (err) {
    // Roll back to pending so the admin can retry
    await service
      .from('payouts')
      .update({
        status: 'pending',
        initiated_at: null,
        failure_reason: (err as Error).message,
      })
      .eq('id', payoutId)
    throw err
  }

  // Phase 4 will unblock this revalidate (currently unreachable).
  // eslint-disable-next-line no-unreachable
  revalidatePath('/admin/payouts')
  // eslint-disable-next-line no-unreachable
  revalidatePath(`/admin/payouts/${payoutId}`)
  // Touch session so the unused-warning is quiet until Phase 4 references it.
  void session
}
