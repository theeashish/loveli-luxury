/**
 * GET /api/intasend/status?ref=<order_number>
 *
 * Phase 2 self-heal endpoint. The contract here is dictated by the
 * ALREADY-WRITTEN frontend (`src/components/checkout/StkPushPanel.tsx`),
 * not invented for this pass: `{ status: string }` where `status` is the
 * order's own status column, and the panel treats `paid | fulfilled |
 * shipped | delivered` as success, `cancelled | refunded | failed |
 * expired` as failure, and anything else (`pending`) as "keep polling".
 *
 * No auth check — `order_number` is an unguessable reference (matches
 * the same posture `/checkout/return` already uses for guest checkout),
 * and this endpoint only ever reads/reconciles state, never mutates
 * anything the caller didn't already have a legitimate reference to.
 *
 * Behaviour:
 *   - If the order is already in a terminal status, return it immediately
 *     — no provider call needed.
 *   - Otherwise, look up the most recent `payments` row for this order
 *     and ask IntaSend for its current state via `verifyPayment`. If
 *     COMPLETE, run the same `applyPaymentSuccess` chain the webhook
 *     uses (source='status_poll') — idempotent either way.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { reconcileByInvoiceId } from '@/lib/payments/payment-service'
import { checkRateLimit, clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TERMINAL_STATUSES = new Set([
  'paid',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'failed',
  'expired',
])

export async function GET(req: Request) {
  const ip = clientIp(req)
  const limit = await checkRateLimit('intasend-status', ip, { limit: 60, windowSeconds: 60 })
  if (!limit.ok) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  const url = new URL(req.url)
  const ref = url.searchParams.get('ref')
  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 })
  }

  const service = createServiceClient()

  const orderRes = await service
    .from('orders')
    .select('id, status, kind, order_number')
    .eq('order_number', ref)
    .maybeSingle()
  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }
  const order = orderRes.data as { id: number; status: string; kind: string; order_number: string }

  if (TERMINAL_STATUSES.has(order.status)) {
    return NextResponse.json({ status: order.status })
  }

  // Not yet terminal — find the invoice this order's STK push produced.
  const paymentRes = await service
    .from('payments')
    .select('invoice_id')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const invoiceId = (paymentRes.data as { invoice_id: string } | null)?.invoice_id
  if (!invoiceId) {
    // STK push hasn't landed a payments row yet (race with /api/checkout/init).
    return NextResponse.json({ status: order.status })
  }

  try {
    const outcome = await reconcileByInvoiceId(
      invoiceId,
      order.id,
      order.kind,
      'status_poll',
    )
    if (outcome.state === 'complete') {
      return NextResponse.json({ status: 'paid' })
    }
    // Re-read the order in case a concurrent webhook already applied it.
    const refreshed = await service
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .maybeSingle()
    return NextResponse.json({
      status: (refreshed.data as { status: string } | null)?.status ?? order.status,
    })
  } catch {
    // Provider call failed (network/timeout) — don't fail the poll; the
    // panel will just try again on its next tick.
    return NextResponse.json({ status: order.status })
  }
}
