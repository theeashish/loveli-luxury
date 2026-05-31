'use server'

/**
 * Admin order-state Server Actions.
 *
 * State machine:
 *   pending → cancelled
 *   paid    → fulfilled → shipped → delivered
 *   paid|fulfilled|shipped → refunded   (Phase 4: real PayHero refund call +
 *                                        inventory restore. Commission claw-
 *                                        back is implemented in migration 008
 *                                        — refunded ledger rows are voided
 *                                        unless already paid out.)
 *
 * Every transition writes an audit_log row with the actor, before/after
 * snapshots, and the action name.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireSuperadmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getTransactionStatus } from '@/lib/payhero/service'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'
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
      total_minor: string | number
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

  // Stamp refs → mark paid → provision (signup) → ledger → v2 preview →
  // receipt → audit, all in the shared helper. The helper tags the audit
  // row with the admin actor_id passed in.
  const applied = await applyPaymentSuccess(service, {
    orderId: order.id,
    orderKind: order.kind,
    payheroCheckoutReference: order.payhero_checkout_reference ?? '',
    mpesaReceipt:
      status.provider_reference ?? status.third_party_reference ?? null,
    externalReference: status.external_reference ?? null,
    source: 'reconcile_admin',
    actorId: session.userId,
  })
  if (!applied.paid) {
    throw new Error(applied.error ?? 'apply failed')
  }
  if (applied.warnings.length > 0) {
    // Non-fatal warnings — surface in a per-warning audit row so the admin
    // page can show them. The order is paid; we don't block on these.
    for (const warning of applied.warnings) {
      await service.from('audit_log').insert({
        actor_id: session.userId,
        action: 'order.reconcile.warning',
        resource_type: 'orders',
        resource_id: String(orderId),
        after_data: { provider: 'payhero', warning },
      })
    }
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath('/shop')
}

/**
 * Superadmin-only: void and PURGE an erroneous order entirely.
 *
 * Hard-delete is gated by strict preconditions so we can never accidentally
 * erase a transaction that touched real money or a partner's earnings:
 *
 *   1. Status must be `pending`, `cancelled`, `expired`, or `failed`.
 *   2. paid_at must be NULL.
 *   3. payhero_mpesa_receipt must be NULL (no real M-Pesa traffic).
 *   4. Zero rows in commission_ledger reference this order.
 *
 * Order_items + payment_attempts cascade-delete via FK. The audit_log row
 * we write here is preserved (audit is append-only — by design we keep a
 * record of what the order *was*).
 */
const purgeInputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
})

export async function purgeOrder(formData: FormData): Promise<void> {
  let session
  try {
    session = await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) throw new Error('Forbidden — superadmin required')
    throw err
  }

  const parsed = purgeInputSchema.safeParse({ orderId: formData.get('orderId') })
  if (!parsed.success) throw new Error('Invalid request')
  const { orderId } = parsed.data

  const service = createServiceClient()

  const orderRes = (await service
    .from('orders')
    .select('id, order_number, status, paid_at, total_minor, kind')
    .eq('id', orderId)
    .maybeSingle()) as unknown as {
    data: {
      id: number
      order_number: string
      status: AnyStatus
      paid_at: string | null
      total_minor: string | number
      kind: string
    } | null
    error: { message: string } | null
  }
  if (orderRes.error || !orderRes.data) throw new Error('Order not found')
  const order = orderRes.data

  // Pull the PayHero refs separately via a service-cast read (types are stale
  // for the payhero_* cols on the orders Row type without a fresh regen).
  const refsRes = (await (service.from('orders') as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        maybeSingle: () => Promise<{
          data: { payhero_mpesa_receipt: string | null } | null
          error: { message: string } | null
        }>
      }
    }
  })
    .select('payhero_mpesa_receipt')
    .eq('id', orderId)
    .maybeSingle())
  const mpesaReceipt = refsRes.data?.payhero_mpesa_receipt ?? null

  const PURGEABLE_STATUSES: AnyStatus[] = ['pending', 'cancelled', 'failed']
  // 'expired' is a custom status on the orders.status enum in some envs —
  // include defensively if it's typed in.
  const purgeableExtras: string[] = ['expired']

  if (
    !PURGEABLE_STATUSES.includes(order.status as AnyStatus) &&
    !purgeableExtras.includes(order.status)
  ) {
    throw new Error(
      `Cannot purge an order in status '${order.status}'. Only pending / cancelled / expired / failed orders are purgeable.`,
    )
  }
  if (order.paid_at) {
    throw new Error('Cannot purge an order that has a paid_at timestamp.')
  }
  if (mpesaReceipt) {
    throw new Error(
      `Cannot purge an order with an M-Pesa receipt (${mpesaReceipt}). Real money moved — refund instead.`,
    )
  }

  // Commission-ledger guard: refuse if any commission rows reference this order.
  const ledgerRes = await service
    .from('commission_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('source_order_id', orderId)
  if (ledgerRes.error) {
    throw new Error(`Commission ledger check failed: ${ledgerRes.error.message}`)
  }
  if ((ledgerRes.count ?? 0) > 0) {
    throw new Error(
      `Cannot purge — ${ledgerRes.count} commission ledger row(s) reference this order. Refund/clawback instead.`,
    )
  }

  // Snapshot for audit before deletion.
  const before = {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    total_minor: String(order.total_minor),
    kind: order.kind,
  }

  // payment_attempts is FK-cascaded from orders, so it deletes with the row.
  // order_items has ON DELETE CASCADE too (per the original schema).
  const delRes = await service.from('orders').delete().eq('id', orderId)
  if (delRes.error) {
    throw new Error(`Delete failed: ${delRes.error.message}`)
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'order.purged',
    resource_type: 'orders',
    resource_id: String(orderId),
    before_data: before,
    after_data: {
      purged_at: new Date().toISOString(),
      reason: 'Superadmin manual purge of erroneous order',
    },
  })

  revalidatePath('/admin/orders')
  redirect('/admin/orders')
}
