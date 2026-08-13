/**
 * GET /api/intasend/status?ref=<order_number>
 *
 * Phase 2 self-heal endpoint. The contract here is dictated by the
 * ALREADY-WRITTEN frontend (`src/components/checkout/StkPushPanel.tsx`):
 * `{ status: string }`, where terminal states are displayed as success or
 * failure and `pending` keeps the panel polling.
 *
 * Security boundary:
 *   - The customer must be signed in.
 *   - The queried order must belong to that authenticated customer.
 *
 * Order numbers are sequential operational references, not bearer secrets.
 * Keeping both checks here prevents status enumeration and prevents arbitrary
 * callers from causing provider-status reconciliation for another order.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'sign in required' }, { status: 401 })
  }

  const url = new URL(req.url)
  const ref = url.searchParams.get('ref')
  if (!ref) {
    return NextResponse.json({ error: 'missing ref' }, { status: 400 })
  }

  // Read ownership through the session-bound client before using the service
  // client for reconciliation. A non-owner deliberately receives the same 404
  // as an unknown order so sequential references cannot be enumerated.
  const orderRes = await supabase
    .from('orders')
    .select('id, status, kind, order_number')
    .eq('order_number', ref)
    .eq('user_id', user.id)
    .maybeSingle()
  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }
  const order = orderRes.data as { id: number; status: string; kind: string; order_number: string }

  if (TERMINAL_STATUSES.has(order.status)) {
    return NextResponse.json({ status: order.status })
  }

  // The service client is used only after the purchaser and order ownership
  // have been proven. It handles the internal payment lookup/reconciliation
  // workflow, which is not exposed to arbitrary callers.
  const service = createServiceClient()
  const paymentRes = await service
    .from('payments')
    .select('invoice_id')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const invoiceId = (paymentRes.data as { invoice_id: string } | null)?.invoice_id
  if (!invoiceId) {
    // STK push has not landed a payments row yet (race with checkout init).
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
    // Provider call failed (network/timeout) — do not fail the poll; the
    // authenticated panel will try again on its next interval.
    return NextResponse.json({ status: order.status })
  }
}
