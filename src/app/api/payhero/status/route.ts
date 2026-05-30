/**
 * GET /api/payhero/status?ref=<order_number>
 *
 * Frontend-poll endpoint. Returns the ORDER state (paid / pending /
 * cancelled / refunded). The webhook is the primary state-flipper, but
 * this endpoint ALSO self-heals: if it finds a pending PayHero order
 * inside the active checkout window, it asks PayHero for canonical
 * status and — if SUCCESS — runs the full mark_order_paid chain right
 * here. That way a missed/late webhook never strands a customer who
 * is still on the success page polling.
 *
 * The self-heal is gated by:
 *   - status === 'pending' (no-op for already-settled orders)
 *   - payment_provider === 'payhero'
 *   - payhero_checkout_reference is set
 *   - order.created_at within the last 10 minutes (the active window)
 * outside that window we fall back to a plain DB read.
 *
 * Auth: caller must own the order (RLS via the user-scoped client).
 *
 * Rate limit: the client polls every ~2s for up to 60s; that's ~30
 * hits per checkout. The self-heal adds one PayHero HTTP call per
 * pending poll, capped naturally by the 10-minute window.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getTransactionStatus } from '@/lib/payhero/service'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELF_HEAL_WINDOW_MS = 10 * 60 * 1000

/**
 * Self-heal: if PayHero confirms SUCCESS, run the full webhook chain
 * server-side via the shared applyPaymentSuccess helper. Never throws.
 */
async function maybeSelfHeal(orderRef: string): Promise<void> {
  try {
    const service = createServiceClient()
    const orderRes = (await service
      .from('orders')
      .select(
        'id, order_number, status, total_minor, kind, payment_provider, payhero_checkout_reference, created_at',
      )
      .eq('order_number', orderRef)
      .maybeSingle()) as unknown as {
      data: {
        id: number
        status: string
        total_minor: string | number
        kind: string
        payment_provider: string | null
        payhero_checkout_reference: string | null
        created_at: string
      } | null
      error: { message: string } | null
    }
    if (orderRes.error || !orderRes.data) return
    const order = orderRes.data

    if (order.status !== 'pending') return
    if (order.payment_provider !== 'payhero') return
    if (!order.payhero_checkout_reference) return
    if (Date.now() - new Date(order.created_at).getTime() > SELF_HEAL_WINDOW_MS) return

    const status = await getTransactionStatus(order.payhero_checkout_reference)
    if (status.status !== 'SUCCESS' || !status.success) return

    // Amount sanity check — refuse if PayHero reports a different amount.
    const expectedMajor = Math.round(Number(order.total_minor) / 100)
    if (typeof status.amount === 'number' && status.amount !== expectedMajor) {
      // eslint-disable-next-line no-console
      console.warn(
        '[status.self-heal] amount mismatch, refusing to flip',
        order.id,
        { expected: expectedMajor, received: status.amount },
      )
      return
    }

    const result = await applyPaymentSuccess(service, {
      orderId: order.id,
      orderKind: order.kind,
      payheroCheckoutReference: order.payhero_checkout_reference,
      mpesaReceipt:
        status.provider_reference ?? status.third_party_reference ?? null,
      externalReference: status.external_reference ?? null,
      source: 'status_self_heal',
    })
    if (!result.paid) {
      // eslint-disable-next-line no-console
      console.warn('[status.self-heal] apply failed', order.id, result.error)
    } else if (result.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[status.self-heal] warnings', order.id, result.warnings)
    }
  } catch (err) {
    // Never let self-heal break the status response — log and move on.
    // eslint-disable-next-line no-console
    console.warn(
      '[status.self-heal] error',
      err instanceof Error ? err.message : String(err),
    )
  }
}

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref')
  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const orderRef = ref
  const userId = session.user.id
  async function readOrder() {
    return (await supabase
      .from('orders')
      .select('id, order_number, status, kind, paid_at, total_minor, currency')
      .eq('order_number', orderRef)
      .eq('user_id', userId)
      .maybeSingle()) as unknown as {
      data: {
        id: number
        order_number: string
        status: string
        kind: string
        paid_at: string | null
        total_minor: string | number
        currency: string
      } | null
      error: { message: string } | null
    }
  }

  // user-scoped read; RLS enforces "user owns this order".
  const r = await readOrder()

  if (r.error) {
    return NextResponse.json({ error: r.error.message }, { status: 500 })
  }
  if (!r.data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Self-heal path: if the order is still pending and we're inside the
  // active checkout window, ask PayHero for canonical status and run
  // the reconcile chain server-side. This means a missed webhook never
  // strands a customer on the success page.
  let data = r.data
  if (data.status === 'pending') {
    await maybeSelfHeal(ref)
    // Re-read; if self-heal flipped the order, the second read sees `paid`.
    const r2 = await readOrder()
    if (!r2.error && r2.data) {
      data = r2.data
    }
  }

  return NextResponse.json({
    orderNumber: data.order_number,
    status: data.status,
    kind: data.kind,
    paidAt: data.paid_at,
    totalMinor: String(data.total_minor),
    currency: data.currency,
  })
}
