'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireSuperadmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getServerEnv } from '@/lib/env'
import { getPaymentProvider } from '@/lib/payments/payment-service'
import type { Json } from '@/types/database'

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
 *   4. Call the provider's B2C transfer API (`getPaymentProvider().initiatePayout`).
 *   5. On API success, store the provider tracking id + raw response on
 *      the row and stamp `initiated_at`. If the amount is over
 *      `INTASEND_PAYOUT_APPROVAL_CEILING_KES`, the row lands in
 *      `pending_approval` instead of `processing` — see `approvePendingPayout`.
 *      On API failure, roll status back to `pending` so the admin can retry.
 *   6. The terminal status (completed / failed) is set by the webhook
 *      (`/api/intasend/webhook`) or the cron sweep, not here.
 */
export async function initiatePayout(formData: FormData): Promise<void> {
  const env = getServerEnv()
  if (!env.ENABLE_PAYOUTS) {
    throw new Error('Payouts are disabled. Set ENABLE_PAYOUTS=true to proceed.')
  }

  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) throw new Error('Forbidden')
    throw err
  }
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

  // Beneficiary name for the IntaSend `transactions[].name` field lives
  // on profiles, not distributors — join through user_id.
  const distRow = await service
    .from('distributors')
    .select('user_id')
    .eq('id', row.distributor_id)
    .maybeSingle()
  const distUserId = (distRow.data as { user_id: string } | null)?.user_id
  const beneficiaryProfile = distUserId
    ? await service.from('profiles').select('full_name').eq('id', distUserId).maybeSingle()
    : null
  const beneficiaryName =
    (beneficiaryProfile?.data as { full_name: string } | null)?.full_name ?? 'Loveli Distributor'

  try {
    const provider = getPaymentProvider()
    const dispatch = await provider.initiatePayout({
      payoutId,
      amountKes,
      msisdn: row.payout_msisdn,
      beneficiaryName,
      narrative: `Loveli Luxury payout ${row.period_year}-${String(row.period_month).padStart(2, '0')}`,
    })

    await service
      .from('payouts')
      .update({
        provider: 'intasend',
        status: dispatch.status, // 'processing' | 'pending_approval'
        tracking_id: dispatch.trackingId,
        account: row.payout_msisdn,
        requires_approval: dispatch.status === 'pending_approval',
        raw_payload: dispatch.raw as unknown as Json,
      })
      .eq('id', payoutId)

    await service.from('audit_log').insert({
      actor_id: session.userId,
      action: 'payout.initiated',
      resource_type: 'payouts',
      resource_id: String(payoutId),
      after_data: {
        provider: 'intasend',
        tracking_id: dispatch.trackingId,
        amount_kes: amountKes,
        msisdn: row.payout_msisdn,
        status: dispatch.status,
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

/**
 * Approve a payout that IntaSend parked in `pending_approval` because its
 * amount exceeded `INTASEND_PAYOUT_APPROVAL_CEILING_KES`. Superadmin only
 * — a regular admin can fire payouts under the ceiling but cannot clear
 * the higher-value gate alone (see migration 046's `pending_approval`
 * state and the ceiling env var in env.ts).
 *
 * Replays the exact `raw_payload` captured at initiate time — the
 * IntaSend `approve()` call takes the full initiate response object, not
 * just the tracking id (see developers.intasend.com/docs/m-pesa-b2c).
 */
export async function approvePendingPayout(formData: FormData): Promise<void> {
  let session
  try {
    session = await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) throw new Error('Forbidden — superadmin required')
    throw err
  }
  const parsed = idSchema.safeParse({ payoutId: formData.get('payoutId') })
  if (!parsed.success) throw new Error('Invalid payout id')
  const { payoutId } = parsed.data

  const service = createServiceClient()

  const r = await service
    .from('payouts')
    .select('id, status, tracking_id, raw_payload')
    .eq('id', payoutId)
    .maybeSingle()
  if (r.error || !r.data) throw new Error('Payout not found')
  const row = r.data as {
    id: number
    status: string
    tracking_id: string | null
    raw_payload: Record<string, unknown> | null
  }

  if (row.status !== 'pending_approval') {
    throw new Error(`Payout is not awaiting approval (status: ${row.status}).`)
  }
  if (!row.raw_payload || !row.tracking_id) {
    throw new Error('Payout is missing its initiate response — cannot approve. Re-initiate instead.')
  }

  const provider = getPaymentProvider()
  const approved = await provider.approvePayout({ payoutId, raw: row.raw_payload })

  await service
    .from('payouts')
    .update({
      status: 'processing',
      approved_by: session.userId,
      raw_payload: approved.raw as unknown as Json,
    })
    .eq('id', payoutId)

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'payout.approved',
    resource_type: 'payouts',
    resource_id: String(payoutId),
    after_data: { tracking_id: approved.trackingId },
  })

  revalidatePath('/admin/payouts')
  revalidatePath(`/admin/payouts/${payoutId}`)
}
