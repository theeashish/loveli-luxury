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
import { getTransactionStatus } from '@/lib/payhero/service'
// Refunds: PayHero does not yet expose a public refund API in our integration.
// Admins issue refunds from the PayHero dashboard, then click "Mark refunded"
// here to update inventory + clawback. See refund() below.

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
    if (!current.payment_provider_ref) {
      throw new Error('Order has no payment reference to refund.')
    }

    // Refunds: the actual money-movement is initiated in the PayHero
    // dashboard (no documented refund API at the time of this
    // integration). This action handles only the DB-side bookkeeping:
    //   1. Restore inventory
    //   2. Void unpaid commission ledger rows
    //   3. Surface paid commissions on /admin/clawbacks for resolution
    //   4. Flip status to refunded
    // Admin is responsible for confirming the refund was issued in
    // PayHero BEFORE clicking refund here. After confirming, the audit
    // log captures the operator's intent.

    // 1. Restore inventory.
    const restoreRes = await service.rpc('restore_order_inventory', {
      p_order_id: orderId,
    })
    if (restoreRes.error) {
      throw new Error(
        `Inventory restore failed: ${restoreRes.error.message}. ` +
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
        provider: current.payment_provider,
        provider_ref: current.payment_provider_ref,
        clawback,
        note:
          'Refund must be issued in PayHero dashboard before this status flip.',
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

// ALLOWED_ACTIONS lives in ./transitions.ts so this 'use server' file
// exports only async functions (Next.js constraint).

/**
 * Admin reconcile action for stuck PayHero orders.
 *
 * Calls PayHero's transaction-status endpoint for an order that's still
 * `pending` despite the customer having paid (typical cause: webhook
 * delivery failure, dropped callback, or — as observed 2026-05-18 —
 * a schema-drift bug in webhook_deliveries that made the dedup RPC
 * throw). If PayHero confirms SUCCESS and amount matches, runs the
 * same RPC chain the webhook would: mark_order_paid →
 * provision_distributor (for distributor_signup orders) →
 * write_commission_ledger → audit_log.
 *
 * Same wire-level logic as POST /api/payhero/reconcile, but invoked
 * as a server action so the admin can trigger it with a form button
 * instead of having to drop into browser DevTools or curl.
 *
 * Idempotent on order state — mark_order_paid short-circuits when the
 * order is already paid.
 */
const reconcileInputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
})

export async function reconcilePayheroPayment(formData: FormData): Promise<void> {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) throw new Error('Forbidden')
    throw err
  }

  const parsed = reconcileInputSchema.safeParse({
    orderId: formData.get('orderId'),
  })
  if (!parsed.success) throw new Error('Invalid request')
  const { orderId } = parsed.data

  const service = createServiceClient()

  // 1. Load the order. TODO(types): regenerate database.ts post-019.
  const orderRes = (await service
    .from('orders')
    .select(
      'id, order_number, status, total_minor, kind, payment_provider, payhero_checkout_reference',
    )
    .eq('id', orderId)
    .maybeSingle()) as unknown as {
    data: {
      id: number
      order_number: string
      status: AnyStatus
      total_minor: string | number
      kind: string
      payment_provider: string | null
      payhero_checkout_reference: string | null
    } | null
    error: { message: string } | null
  }
  if (orderRes.error || !orderRes.data) throw new Error('Order not found')
  const order = orderRes.data

  if (order.status !== 'pending') {
    // Idempotent UX: don't blow up if a concurrent webhook just settled it.
    revalidatePath(`/admin/orders/${orderId}`)
    return
  }
  if (order.payment_provider !== 'payhero') {
    throw new Error(
      `Order provider is '${order.payment_provider}', not payhero — nothing to reconcile.`,
    )
  }
  if (!order.payhero_checkout_reference) {
    throw new Error(
      'Order has no PayHero checkout reference. Likely the STK push never returned a reference; cannot reconcile.',
    )
  }

  // 2. Ask PayHero for the canonical transaction state.
  let status
  try {
    status = await getTransactionStatus(order.payhero_checkout_reference)
  } catch (e) {
    throw new Error(`PayHero status lookup failed: ${(e as Error).message}`)
  }

  if (status.status !== 'SUCCESS' || !status.success) {
    throw new Error(
      `PayHero reports status '${status.status}' for this order — not SUCCESS. ` +
        `Message: ${status.message ?? '(none)'}. Order left pending.`,
    )
  }

  // 3. Amount sanity check.
  const expectedMajor = Math.round(Number(order.total_minor) / 100)
  if (typeof status.amount === 'number' && status.amount !== expectedMajor) {
    throw new Error(
      `Amount mismatch — expected Kes ${expectedMajor}, PayHero says Kes ${status.amount}. ` +
        `Refusing to mark paid.`,
    )
  }

  const mpesaReceipt =
    status.provider_reference ?? status.third_party_reference ?? null

  // 4. Stamp the PayHero refs on the order.
  await (service.from('orders') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{
        error: { message: string } | null
      }>
    }
  })
    .update({
      payhero_external_reference: status.external_reference ?? null,
      payhero_mpesa_receipt: mpesaReceipt,
    })
    .eq('id', order.id)

  // 5. Idempotent RPC chain — same one the webhook runs.
  const paidAt = new Date().toISOString()
  const markRes = (await service.rpc('mark_order_paid', {
    p_order_id: order.id,
    p_provider_ref: mpesaReceipt ?? order.payhero_checkout_reference,
    p_paid_at: paidAt,
  })) as { error: { message: string } | null }
  if (markRes.error) {
    throw new Error(`mark_order_paid failed: ${markRes.error.message}`)
  }

  if (order.kind === 'distributor_signup') {
    const provRes = (await service.rpc('provision_distributor', {
      p_order_id: order.id,
    })) as { error: { message: string } | null }
    if (provRes.error) {
      throw new Error(
        `Order marked paid but distributor provisioning failed: ${provRes.error.message}. ` +
          `Investigate before retrying.`,
      )
    }
  }

  const ledgerRes = (await service.rpc('write_commission_ledger', {
    p_order_id: order.id,
  })) as { error: { message: string } | null }
  if (ledgerRes.error) {
    // Non-fatal — order is paid. Log warning via audit but don't throw.
    await service.from('audit_log').insert({
      actor_id: session.userId,
      action: 'order.reconcile.ledger_warning',
      resource_type: 'orders',
      resource_id: String(orderId),
      after_data: {
        provider: 'payhero',
        warning: ledgerRes.error.message,
        mpesa_receipt: mpesaReceipt,
      },
    })
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'order.reconcile.payhero',
    resource_type: 'orders',
    resource_id: String(orderId),
    before_data: { status: 'pending' },
    after_data: {
      status: 'paid',
      provider: 'payhero',
      checkout_reference: order.payhero_checkout_reference,
      mpesa_receipt: mpesaReceipt,
      reconciled_at: paidAt,
    },
  })

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/shop')
}
