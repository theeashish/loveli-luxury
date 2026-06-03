'use server'

/**
 * Admin order-state Server Actions.
 *
 * State machine:
 *   pending → cancelled
 *   paid    → fulfilled → shipped → delivered
 *   paid|fulfilled|shipped → refunded
 *
 * Refund money movement is initiated in the provider dashboard (IntaSend
 * for new orders, PayHero for historical pre-2026-06-03 orders). This
 * action handles only the DB-side bookkeeping: inventory restore +
 * commission claw-back + status flip. Commission claw-back is implemented
 * in migration 008 — refunded ledger rows are voided unless already paid
 * out, in which case they surface on /admin/clawbacks for a human
 * decision.
 *
 * Every transition writes an audit_log row with the actor, before/after
 * snapshots, and the action name.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireSuperadmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Refund takes a different path: provider-side refund (admin issues in
  // provider dashboard) → inventory restore via RPC → commission clawback
  // → status flip. We branch early because the bare status flip is wrong
  // for refunds (no money movement triggered here; inventory must come back).
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

    // The actual money-movement is initiated in the provider dashboard
    // (IntaSend for new orders, PayHero for historical pre-2026-06-03
    // orders — neither exposes a documented refund API in our integration
    // at this time). This action handles only the DB-side bookkeeping.
    // Admin is responsible for confirming the refund was issued in the
    // provider BEFORE clicking refund here.

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

    // 2. Commission claw-back. Voids unpaid commission_ledger rows for
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

    // 2a. If commissions on this order were already paid out, queue a
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

    // 3. Status flip with optimistic lock.
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
          'Refund must be issued in the provider dashboard before this status flip.',
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
 * Admin reconcile action for stuck orders.
 *
 * Phase 0 (2026-06-03): PayHero has been removed. The IntaSend status
 * probe lands in Phase 2 of the migration; until then this action throws
 * a clear "not implemented" error so the admin sees the truthful state
 * rather than a silent no-op.
 *
 * When Phase 2 lands, the flow will be:
 *   1. Load the order's payments row (status='pending').
 *   2. Call IntaSend's status endpoint with payments.invoice_id.
 *   3. If SUCCESS + amount matches, call applyPaymentSuccess() with
 *      source='reconcile_admin' to run the same RPC chain the webhook
 *      would. mark_order_paid is idempotent so concurrent reconciles
 *      are safe.
 *   4. If FAILED or amount mismatches, error and leave the order pending.
 */
const reconcileInputSchema = z.object({
  orderId: z.coerce.number().int().positive(),
})

export async function reconcilePayment(formData: FormData): Promise<void> {
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

  // Touch parsed/session so the unused-warning is quiet until Phase 2
  // wires the real implementation.
  void parsed
  void session

  throw new Error(
    'Admin reconcile is not wired in Phase 0 of the PayHero → IntaSend migration. ' +
      'Phase 2 introduces the IntaSend status probe and the matching applyPaymentSuccess chain.',
  )
}

/**
 * Superadmin-only: void and PURGE an erroneous order entirely.
 *
 * Hard-delete is gated by strict preconditions so we can never accidentally
 * erase a transaction that touched real money or a partner's earnings:
 *
 *   1. Status must be `pending`, `cancelled`, `expired`, or `failed`.
 *   2. paid_at must be NULL.
 *   3. No `payments` row in status='complete' for the order. (Replaces
 *      the legacy "payhero_mpesa_receipt IS NULL" check — the payments
 *      table is the new source of truth for "did money move".)
 *   4. Zero rows in commission_ledger reference this order.
 *
 * Order_items + payment_attempts cascade-delete via FK. The new `payments`
 * rows are cascade-deleted by `ON DELETE CASCADE` on `payments.order_id`
 * (migration 047). The audit_log row we write here is preserved (audit is
 * append-only — by design we keep a record of what the order *was*).
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

  // New source of truth for "did money move": a payments row with
  // status='complete'. The legacy payhero_mpesa_receipt column is no
  // longer consulted (it stays nullable on disk for historical records).
  const completePaymentsRes = (await (service
    .from('payments' as never) as unknown as {
    select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{
          count: number | null
          error: { message: string } | null
        }>
      }
    }
  })
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('status', 'complete')) as {
    count: number | null
    error: { message: string } | null
  }
  if (completePaymentsRes.error) {
    throw new Error(
      `payments check failed: ${completePaymentsRes.error.message}`,
    )
  }
  if ((completePaymentsRes.count ?? 0) > 0) {
    throw new Error(
      'Cannot purge — at least one payments row is status=complete for this order. Real money moved; refund instead.',
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
  // payments.order_id has ON DELETE CASCADE (migration 047).
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
