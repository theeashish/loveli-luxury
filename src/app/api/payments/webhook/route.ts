/**
 * POST /api/payments/webhook
 *
 * Flutterwave delivers a webhook for every charge. This is the canonical
 * source of truth for marking an order paid; the /checkout/return page is
 * just a UX fast-path against the same RPC.
 *
 * Defence in depth:
 *   1. `verif-hash` header must match `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
 *      (constant-time compare via verifyWebhookSignature).
 *   2. Cross-check by calling Flutterwave's verify endpoint with the
 *      transaction id — confirms the event is real and the amount matches.
 *   3. The mark_order_paid RPC is idempotent on the order_status column, so
 *      duplicate deliveries are safe.
 *
 * Always return 200 once we've recognised the order. Returning non-2xx makes
 * Flutterwave retry; we only want retries when our own infrastructure is
 * unreachable, not when the order is already settled or unknown.
 */

import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  verifyTransaction,
  verifyWebhookSignature,
} from '@/lib/flutterwave/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface FlutterwaveWebhookEvent {
  event?: string
  'event.type'?: string
  data?: {
    id?: number
    tx_ref?: string
    status?: string
    amount?: number
    currency?: string
  }
}

export async function POST(req: NextRequest) {
  // 1. Signature verification (against the raw header)
  const signature = req.headers.get('verif-hash')
  if (!verifyWebhookSignature(signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  // 2. Parse the body
  let payload: FlutterwaveWebhookEvent
  try {
    payload = (await req.json()) as FlutterwaveWebhookEvent
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const eventName = payload.event ?? payload['event.type'] ?? ''
  const data = payload.data
  if (!data) {
    return NextResponse.json({ ok: true, ignored: 'no data' })
  }

  // Refund events are handled separately. FW emits varying shapes — we
  // pattern-match loosely on the event name and a successful refund
  // status. The handler is idempotent against the synchronous admin
  // refund path (which already flipped the order to 'refunded').
  const isRefundEvent =
    /refund/i.test(eventName) ||
    /transaction\.refunded/i.test(eventName)
  if (isRefundEvent) {
    return await handleRefundEvent(data)
  }

  // We only act on successful charge completions in Phase 3. Failed charges
  // leave the order in 'pending' until cancelled by an admin or the customer
  // retries — explicit failure handling is Step 7 (admin order surface).
  const isChargeSuccess =
    /charge\.completed/i.test(eventName) && data.status === 'successful'
  if (!isChargeSuccess) {
    return NextResponse.json({ ok: true, ignored: eventName || 'unrecognised' })
  }

  if (!data.id || !data.tx_ref) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // 3. Cross-check against the verify endpoint. Defence-in-depth against a
  // forged or replayed body that somehow passed the hash check.
  let verified
  try {
    verified = await verifyTransaction(data.id)
  } catch (err) {
    // Verify endpoint hiccup — let Flutterwave retry by returning 5xx
    return NextResponse.json(
      { error: 'verify failed', detail: (err as Error).message },
      { status: 502 },
    )
  }

  if (
    verified.status !== 'successful' ||
    verified.tx_ref !== data.tx_ref ||
    verified.id !== data.id
  ) {
    return NextResponse.json({ ok: true, ignored: 'verify mismatch' })
  }

  // 4. Look up our order by tx_ref (= order_number)
  const service = createServiceClient()
  const orderRes = await service
    .from('orders')
    .select('id, status, total_minor, currency, kind')
    .eq('order_number', data.tx_ref)
    .maybeSingle()

  if (orderRes.error) {
    return NextResponse.json(
      { error: 'order lookup failed', detail: orderRes.error.message },
      { status: 500 },
    )
  }
  const order = orderRes.data as
    | { id: number; status: string; total_minor: string; currency: string; kind: string }
    | null
  if (!order) {
    // Unknown tx_ref. Acknowledge so Flutterwave doesn't retry forever; an
    // admin can investigate via dashboard later.
    return NextResponse.json({ ok: true, ignored: 'order not found' })
  }

  // 5. Amount sanity check. We stored total in minor units; FW reports major.
  const expectedMajor = Number(BigInt(order.total_minor) / 100n)
  if (verified.currency !== order.currency || verified.amount !== expectedMajor) {
    return NextResponse.json({ ok: true, ignored: 'amount mismatch' })
  }

  // 6. Atomic state flip + inventory decrement (idempotent)
  const rpcRes = await service.rpc('mark_order_paid', {
    p_order_id: order.id,
    p_provider_ref: String(verified.id),
  })
  if (rpcRes.error) {
    // RPC error — typically inventory underflow rolls everything back.
    // Return 5xx so FW retries and we get visibility in logs.
    return NextResponse.json(
      { error: 'mark_order_paid failed', detail: rpcRes.error.message },
      { status: 500 },
    )
  }

  if (rpcRes.data === true) {
    // First time we transitioned this order. Three follow-ups, in order:
    //
    //   1. Provision distributor (signup orders only). Must run before the
    //      commission ledger write so the new distributor's tree row exists
    //      — even though Phase 4 commissions only walk the SPONSOR's upline
    //      (so the new distributor's own row isn't strictly required), this
    //      ordering keeps the post-paid state consistent for downstream
    //      consumers and is the natural place to fail-loud on a missing
    //      sponsor.
    if (order.kind === 'distributor_signup') {
      const provRes = await service.rpc('provision_distributor', {
        p_order_id: order.id,
      })
      if (provRes.error) {
        return NextResponse.json(
          {
            error: 'distributor provisioning failed',
            detail: provRes.error.message,
          },
          { status: 500 },
        )
      }
    }

    //   2. Commission ledger fan-out. Idempotent (skips if rows already
    //      exist), so a webhook retry after a partial success resolves
    //      cleanly. On error we return 5xx so Flutterwave retries.
    const ledgerRes = await service.rpc('write_commission_ledger', {
      p_order_id: order.id,
    })
    if (ledgerRes.error) {
      return NextResponse.json(
        {
          error: 'commission ledger write failed',
          detail: ledgerRes.error.message,
        },
        { status: 500 },
      )
    }

    //   3. Storefront inventory invalidation.
    try {
      revalidatePath('/shop')
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ ok: true, transitioned: rpcRes.data === true })
}


// -----------------------------------------------------------------------------
// Refund event handler
// -----------------------------------------------------------------------------
// Flutterwave's refund webhook event shape varies by account version. We
// extract `tx_ref` (or fall back to `flw_ref` / `transaction_reference`) to
// resolve the order, then run the same trio the synchronous admin action
// runs: inventory restore → claw-back → status flip. If the order is
// already in 'refunded', we ack and exit — the admin path beat us here.

interface RefundEventData {
  id?: number
  status?: string
  tx_ref?: string
  flw_ref?: string
  transaction_reference?: string
  amount?: number
}

async function handleRefundEvent(data: RefundEventData): Promise<NextResponse> {
  const status = (data.status ?? '').toLowerCase()
  if (status !== 'completed' && status !== 'successful') {
    return NextResponse.json({ ok: true, ignored: `refund status ${status || 'unknown'}` })
  }

  // Resolve the order. tx_ref maps to our order_number; if absent we fall
  // back to looking up by the original transaction reference stored on the
  // order's payment_provider_ref.
  const orderNumber =
    data.tx_ref ??
    data.transaction_reference ??
    null

  const service = createServiceClient()

  type OrderRefundRow = { id: number; status: string }
  let orderRow: OrderRefundRow | null = null

  if (orderNumber) {
    const r = await service
      .from('orders')
      .select('id, status')
      .eq('order_number', orderNumber)
      .maybeSingle()
    if (r.error) {
      return NextResponse.json(
        { error: 'refund lookup failed', detail: r.error.message },
        { status: 500 },
      )
    }
    orderRow = (r.data as OrderRefundRow | null) ?? null
  }

  if (!orderRow) {
    return NextResponse.json({ ok: true, ignored: 'refund order not found' })
  }

  // Idempotency: if an admin already ran the synchronous refund, the order
  // is already 'refunded' and there's nothing left to do.
  if (orderRow.status === 'refunded') {
    return NextResponse.json({ ok: true, ignored: 'already refunded' })
  }

  // Only proceed on statuses the inventory-restore RPC accepts. Anything
  // else (e.g. the order was never paid) is a refund we don't know how to
  // apply — ack so FW doesn't retry forever; surface for ops via audit_log.
  if (
    orderRow.status !== 'paid' &&
    orderRow.status !== 'fulfilled' &&
    orderRow.status !== 'shipped'
  ) {
    await service.from('audit_log').insert({
      action: 'refund.unmatched_status',
      resource_type: 'orders',
      resource_id: String(orderRow.id),
      after_data: {
        status: orderRow.status,
        refund: JSON.parse(JSON.stringify(data)),
      },
    })
    return NextResponse.json({ ok: true, ignored: `status ${orderRow.status}` })
  }

  // Mirror the synchronous flow: inventory restore → claw-back → status flip.
  const restoreRes = await service.rpc('restore_order_inventory', {
    p_order_id: orderRow.id,
  })
  if (restoreRes.error) {
    return NextResponse.json(
      { error: 'inventory restore failed', detail: restoreRes.error.message },
      { status: 500 },
    )
  }

  const clawRes = await service.rpc('void_unpaid_commissions_for_order', {
    p_order_id: orderRow.id,
  })
  if (clawRes.error) {
    return NextResponse.json(
      { error: 'clawback failed', detail: clawRes.error.message },
      { status: 500 },
    )
  }
  const clawData = clawRes.data as
    | { voided: number; voided_amount_minor: number; already_paid: number; paid_amount_minor: number }
    | null

  // Queue a clawback resolution row if any commissions were already paid.
  // UNIQUE(order_id) guards against duplicate inserts when admin path and
  // webhook path race.
  if (clawData && clawData.already_paid > 0) {
    await service
      .from('clawback_resolutions')
      .insert({
        order_id: orderRow.id,
        paid_amount_minor: String(clawData.paid_amount_minor),
        paid_count: clawData.already_paid,
      })
      .select('id')
      .maybeSingle()
  }

  const upd = await service
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', orderRow.id)
    .eq('status', orderRow.status)
    .select('id')
    .maybeSingle()
  if (upd.error || !upd.data) {
    // Status changed under us; benign race. Ack.
    return NextResponse.json({ ok: true, ignored: 'race lost on status flip' })
  }

  await service.from('audit_log').insert({
    action: 'order.refund.webhook',
    resource_type: 'orders',
    resource_id: String(orderRow.id),
    before_data: { status: orderRow.status },
    after_data: {
      status: 'refunded',
      flutterwave_refund_id: data.id ?? null,
      amount_kes: data.amount ?? null,
      clawback: clawRes.data ?? null,
    },
  })

  try {
    revalidatePath('/shop')
    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderRow.id}`)
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true, refunded: orderRow.id })
}
