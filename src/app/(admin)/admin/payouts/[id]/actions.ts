'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { initiateB2C, buildCallbackUrl } from '@/lib/payhero/service'
import { publicEnv } from '@/lib/env'
import { getServerEnv } from '@/lib/env'

const idSchema = z.object({
  payoutId: z.coerce.number().int().positive(),
})

/**
 * Initiate the M-Pesa B2C transfer for a `pending` payout.
 *
 * Steps:
 *   1. ENABLE_PAYOUTS feature gate.
 *   2. Optimistically lock the row by transitioning status pending → processing
 *      with `.eq('status', 'pending')`. If another caller beat us we abort.
 *   3. Call PayHero B2C /withdraw (see lib/payhero/service.ts initiateB2C).
 *   4. On API success, store the provider transfer reference (historical
 *      column name: flutterwave_transfer_id; now holds the PayHero B2C
 *      reference — column renaming is a separate scheduled refactor) and
 *      initiated_at. On API failure, roll status back to `pending` so the
 *      admin can retry.
 *   5. The terminal status (completed / failed) is set by the webhook.
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

  const amountKes = Number(BigInt(row.net_total_minor) / 100n)

  try {
    const callbackUrl = buildCallbackUrl(
      publicEnv.NEXT_PUBLIC_APP_URL,
      '/api/payhero/payout-webhook',
    )
    const transfer = await initiateB2C({
      amountKes,
      phone: row.payout_msisdn,
      payoutId,
      callbackUrl,
      customerName: `Loveli distributor ${payoutId}`,
    })

    // TODO(types): regenerate database.ts post-migration-019; payouts
    // has new payhero_transfer_reference + provider columns from 019.
    await (
      service.from('payouts') as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (col: string, val: unknown) => Promise<{
            error: { message: string } | null
          }>
        }
      }
    )
      .update({
        provider: 'payhero',
        payhero_transfer_reference: transfer.reference ?? null,
      })
      .eq('id', payoutId)

    await service.from('audit_log').insert({
      actor_id: session.userId,
      action: 'payout.initiated',
      resource_type: 'payouts',
      resource_id: String(payoutId),
      after_data: {
        provider: 'payhero',
        payhero_reference: transfer.reference ?? null,
        amount_kes: amountKes,
        msisdn: row.payout_msisdn,
      },
    })
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

  revalidatePath('/admin/payouts')
  revalidatePath(`/admin/payouts/${payoutId}`)
}
