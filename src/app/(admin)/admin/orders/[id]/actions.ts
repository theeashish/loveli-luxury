'use server'

/**
 * Admin order-state Server Actions.
 *
 * State machine:
 *   pending → cancelled
 *   paid    → fulfilled → shipped → delivered
 *   paid|fulfilled|shipped → refunded   (Phase 4: real Flutterwave refund
 *                                        API call + inventory restore.
 *                                        Commission claw-back is NOT yet
 *                                        implemented — refunded ledger
 *                                        rows remain payable; that's a
 *                                        Phase 5 task tied to MLM-law
 *                                        chargeback rules.)
 *
 * Every transition writes an audit_log row with the actor, before/after
 * snapshots, and the action name.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { refundTransaction } from '@/lib/flutterwave/service'

const ACTIONS = ['cancel', 'fulfill', 'ship', 'deliver', 'refund'] as const
type Action = (typeof ACTIONS)[number]

type AnyStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'refunded'

const TRANSITIONS: Record<Action, { from: AnyStatus[]; to: AnyStatus }> = {
  cancel: { from: ['pending'], to: 'cancelled' },
  fulfill: { from: ['paid'], to: 'fulfilled' },
  ship: { from: ['fulfilled'], to: 'shipped' },
  deliver: { from: ['shipped'], to: 'delivered' },
  refund: { from: ['paid', 'fulfilled', 'shipped'], to: 'refunded' },
}

const inputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  action: z.enum(ACTIONS),
})

/**
 * Server Action — invoked directly from the admin detail page's form action.
 *
 * Errors throw so Next.js surfaces them via the error boundary; success
 * returns void after revalidation. (We deliberately don't return a result
 * object because Next's `<form action={...}>` types only accept `void` /
 * `Promise<void>`. If we need user-facing error toasts later, switch the
 * call site to `useFormState`.)
 */
export async function transitionOrderStatus(formData: FormData): Promise<void> {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      throw new Error('Forbidden')
    }
    throw err
  }

  const parsed = inputSchema.safeParse({
    orderId: formData.get('orderId'),
    action: formData.get('action'),
  })
  if (!parsed.success) throw new Error('Invalid request')

  const { orderId, action } = parsed.data
  const transition = TRANSITIONS[action]

  const service = createServiceClient()

  // Refund takes a different path: FW API call → inventory restore via RPC
  // → status flip. We branch early because the bare status flip is wrong
  // for refunds (no FW money movement, no inventory return).
  if (action === 'refund') {
    const orderRes = await service
      .from('orders')
      .select('id, status, payment_provider, payment_provider_ref, total_minor')
      .eq('id', orderId)
      .maybeSingle()
    if (orderRes.error || !orderRes.data) throw new Error('Order not found')
    const current = orderRes.data as {
      id: number
      status: AnyStatus
      payment_provider: string | null
      payment_provider_ref: string | null
      total_minor: string
    }

    if (!TRANSITIONS.refund.from.includes(current.status)) {
      throw new Error(`Cannot refund an order in status "${current.status}".`)
    }
    if (
      current.payment_provider !== 'flutterwave' ||
      !current.payment_provider_ref
    ) {
      throw new Error('Order has no Flutterwave transaction reference to refund.')
    }

    const txId = Number(current.payment_provider_ref)
    if (!Number.isFinite(txId)) {
      throw new Error('Stored payment_provider_ref is not numeric.')
    }

    // 1. Hit Flutterwave first. If this fails the order stays paid and the
    //    admin can retry — no inventory change, no status flip.
    let refundResult
    try {
      refundResult = await refundTransaction(txId)
    } catch (err) {
      throw new Error(`Flutterwave refund failed: ${(err as Error).message}`)
    }

    // 2. Restore inventory. The RPC raises if the order isn't in a
    //    refundable status; matches our app-level check above but adds a
    //    second guard at the DB.
    const restoreRes = await service.rpc('restore_order_inventory', {
      p_order_id: orderId,
    })
    if (restoreRes.error) {
      throw new Error(
        `Refund issued at Flutterwave (id ${refundResult.flutterwaveRefundId}) ` +
          `but inventory restore failed: ${restoreRes.error.message}. ` +
          `Investigate before retrying.`,
      )
    }

    // 3. Commission claw-back. Voids unpaid commission_ledger rows for
    //    this order; surfaces a count of already-paid rows so the admin
    //    can resolve manually if needed (Phase 5 does not auto-reverse
    //    disbursed commissions — see migration 008 header).
    const clawbackRes = await service.rpc('void_unpaid_commissions_for_order', {
      p_order_id: orderId,
    })
    if (clawbackRes.error) {
      throw new Error(
        `Refund issued and inventory restored, but commission claw-back ` +
          `failed: ${clawbackRes.error.message}. Investigate before ` +
          `flipping status.`,
      )
    }
    const clawback = clawbackRes.data as {
      voided: number
      voided_amount_minor: number
      already_paid: number
      paid_amount_minor: number
    } | null

    // 3a. If commissions on this order were already paid out, queue a
    //     clawback_resolutions row so it surfaces on /admin/clawbacks for
    //     a human decision (write-off or deduct-from-future-payout).
    //     UNIQUE(order_id) makes the insert idempotent across retries.
    if (clawback && clawback.already_paid > 0) {
      await service
        .from('clawback_resolutions')
        .insert({
          order_id: orderId,
          paid_amount_minor: String(clawback.paid_amount_minor),
          paid_count: clawback.already_paid,
        })
        .select('id')
        .maybeSingle() // tolerate UNIQUE conflict from a webhook race
    }

    // 4. Status flip with optimistic lock.
    const update = await service
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orderId)
      .eq('status', current.status)
      .select('id, status')
      .maybeSingle()
    if (update.error || !update.data) {
      throw new Error('Status changed by another user — please refresh.')
    }

    await service.from('audit_log').insert({
      actor_id: session.userId,
      action: 'order.refund',
      resource_type: 'orders',
      resource_id: String(orderId),
      before_data: { status: current.status },
      after_data: {
        status: 'refunded',
        flutterwave_refund_id: refundResult.flutterwaveRefundId,
        flutterwave_refund_status: refundResult.status,
        amount_kes: refundResult.amountKes,
        clawback,
      },
    })

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/shop')
    return
  }

  // Plain status flips for the rest of the state machine.
  const orderRes = await service
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderRes.error || !orderRes.data) {
    throw new Error('Order not found')
  }
  const current = orderRes.data as { id: number; status: AnyStatus }

  if (!transition.from.includes(current.status)) {
    throw new Error(`Cannot ${action} an order in status "${current.status}".`)
  }

  const update = await service
    .from('orders')
    .update({ status: transition.to })
    .eq('id', orderId)
    .eq('status', current.status) // optimistic lock against concurrent transitions
    .select('id, status')
    .maybeSingle()

  if (update.error || !update.data) {
    throw new Error('Status changed by another user — please refresh.')
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: `order.${action}`,
    resource_type: 'orders',
    resource_id: String(orderId),
    before_data: { status: current.status },
    after_data: { status: transition.to },
  })

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
}

export const ALLOWED_ACTIONS: Record<AnyStatus, Action[]> = {
  pending: ['cancel'],
  paid: ['fulfill', 'refund'],
  fulfilled: ['ship', 'refund'],
  shipped: ['deliver', 'refund'],
  delivered: [],
  cancelled: [],
  failed: [],
  refunded: [],
}
