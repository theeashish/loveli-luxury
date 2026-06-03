/**
 * GET /api/intasend/status?ref=<order_number>
 *
 * Read-only polling endpoint. The StkPushPanel hits this every 2.5s while
 * the customer is staring at their phone waiting for the M-Pesa PIN prompt.
 * Returns the canonical order status from our DB (NOT IntaSend's live
 * status — the webhook is the source of truth, and that has already
 * landed by the time the customer's STK push completes successfully).
 *
 * Self-heal path: if the order is still `pending` and we have a
 * `payments` row with status `pending` for it, we OPTIONALLY consult
 * IntaSend's status endpoint to catch the case where the webhook didn't
 * deliver. This is the "third defence layer" the disaster-recovery
 * runbook documents (webhook → self-heal → cron sweep). The self-heal
 * branch only fires when the webhook hasn't landed in a reasonable
 * window so we don't burn IntaSend quota on every poll tick.
 *
 * Phase 2 (2026-06-03) status: the DB read is wired; the IntaSend
 * status probe is included but gated on a 30 s grace window from the
 * last `payment_attempts` row to avoid hammering IntaSend on every
 * 2.5 s tick.
 *
 * Public surface: no auth required (the order_number is the customer's
 * own random identifier; leaking status to a stranger reveals nothing
 * that the customer's own order page wouldn't reveal).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getIntasend } from '@/lib/intasend/client'
import {
  collectionStatusSchema,
  intasendStateToPaymentStatus,
} from '@/lib/intasend/types'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELF_HEAL_GRACE_MS = 30 * 1_000

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')
  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 })
  }

  const service = createServiceClient()

  const orderRes = await service
    .from('orders')
    .select('id, order_number, status, kind, total_minor, payment_provider')
    .eq('order_number', ref)
    .maybeSingle()
  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const order = orderRes.data as {
    id: number
    order_number: string
    status: string
    kind: string
    total_minor: string | number
    payment_provider: string | null
  }

  // Happy path: terminal status reached. Return immediately.
  if (
    order.status === 'paid' ||
    order.status === 'fulfilled' ||
    order.status === 'shipped' ||
    order.status === 'delivered' ||
    order.status === 'cancelled' ||
    order.status === 'expired' ||
    order.status === 'failed' ||
    order.status === 'refunded'
  ) {
    return NextResponse.json({ status: order.status })
  }

  // Self-heal branch: still pending. Only consult IntaSend if at least
  // `SELF_HEAL_GRACE_MS` has passed since the last STK attempt — that
  // window lets the webhook do its job for the common case and bounds
  // our IntaSend API consumption.
  const recentAttemptRes = await service
    .from('payment_attempts')
    .select('attempted_at')
    .eq('order_id', order.id)
    .eq('attempt_type', 'stk_push')
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const recentAttempt = recentAttemptRes.data as { attempted_at: string } | null
  if (!recentAttempt) return NextResponse.json({ status: order.status })

  const ageMs = Date.now() - new Date(recentAttempt.attempted_at).getTime()
  if (ageMs < SELF_HEAL_GRACE_MS) {
    return NextResponse.json({ status: order.status })
  }

  // Find the matching payments row so we know which invoice_id to ask
  // IntaSend about.
  const paymentRes = (await (service.from('payments' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => {
            maybeSingle: () => Promise<{
              data: { invoice_id: string; status: string } | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  })
    .select('invoice_id, status')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: { invoice_id: string; status: string } | null
    error: { message: string } | null
  }
  if (!paymentRes.data) return NextResponse.json({ status: order.status })
  const payment = paymentRes.data

  // Ask IntaSend; tolerate any error and just return our DB state.
  try {
    const intasend = getIntasend()
    const collection = intasend.collection() as unknown as {
      status: (invoiceID: string) => Promise<unknown>
    }
    const raw = await collection.status(payment.invoice_id)
    const parsed = collectionStatusSchema.safeParse(raw)
    if (!parsed.success) return NextResponse.json({ status: order.status })

    const mapped = intasendStateToPaymentStatus(parsed.data.invoice.state)
    if (mapped !== 'complete') {
      return NextResponse.json({ status: order.status })
    }

    // Amount sanity check before flipping the order paid.
    const reportedAmount = parsed.data.invoice.value
    const expectedMajor = Math.round(Number(order.total_minor) / 100)
    if (
      typeof reportedAmount !== 'undefined' &&
      Number(reportedAmount) !== expectedMajor
    ) {
      return NextResponse.json({ status: order.status })
    }

    const mpesa = parsed.data.invoice.mpesa_reference ?? null
    const applied = await applyPaymentSuccess(service, {
      orderId: order.id,
      orderKind: order.kind,
      provider: 'intasend',
      invoiceId: payment.invoice_id,
      providerRef: mpesa ?? payment.invoice_id,
      receipt: mpesa,
      source: 'status_poll',
      rawPayload: parsed.data as unknown as Record<string, unknown>,
    })
    return NextResponse.json({
      status: applied.paid ? 'paid' : order.status,
    })
  } catch {
    return NextResponse.json({ status: order.status })
  }
}
