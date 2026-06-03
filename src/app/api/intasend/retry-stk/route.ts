/**
 * POST /api/intasend/retry-stk
 *
 * Re-fire the M-Pesa STK push for an order whose previous prompt expired
 * (the 60 s Daraja lifetime elapsed) or whose webhook never landed. The
 * StkPushPanel calls this from its "Resend M-Pesa prompt" button.
 *
 * Crucially: this endpoint creates NO new order. It uses the existing
 * `order_number` so:
 *   - the webhook dedup table (UNIQUE(provider, event_id)) keeps everything
 *     correlated;
 *   - the partial unique index `idx_orders_one_pending_retail_per_user`
 *     (migration 021) is not tripped;
 *   - the customer cannot be charged twice for one checkout intent — the
 *     dispatcher's payments row dedup ensures a single payments row per
 *     invoice, and the existing payments row from the previous attempt
 *     is closed first.
 *
 * Auth: the order must be owned by the signed-in user (or be a guest
 * order with a matching customer_email). The orderNumber-from-body is
 * the lookup key; the user_id from the session is the ownership check.
 *
 * Phase 2 (2026-06-03) of the PayHero → IntaSend migration.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initiatePayment } from '@/lib/payments/dispatcher'
import { checkRateLimit, clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    orderNumber: z.string().min(3).max(50),
  })
  .strict()

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit('intasend_retry_stk', clientIp(req), {
    limit: 5,
    windowSeconds: 60,
  })
  if (!rl.ok) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rl.resetMs - Date.now()) / 1000),
    )
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'malformed json' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const { orderNumber } = parsed.data

  // Auth.
  const supabase = createClient()
  const userRes = await supabase.auth.getUser()
  const user = userRes.data.user
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Load + ownership check.
  const orderRes = await service
    .from('orders')
    .select(
      'id, order_number, status, kind, customer_email, customer_phone, total_minor, currency, user_id',
    )
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }
  const order = orderRes.data as {
    id: number
    order_number: string
    status: string
    kind: string
    customer_email: string
    customer_phone: string | null
    total_minor: string | number
    currency: string
    user_id: string | null
  }
  if (order.user_id !== null && order.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json(
      { error: `order is not pending (current: ${order.status})` },
      { status: 409 },
    )
  }
  if (!order.customer_phone) {
    return NextResponse.json(
      { error: 'no customer phone on order' },
      { status: 400 },
    )
  }

  // Close any existing in-flight payments row for this order — the previous
  // STK is presumably dead (panel hit timeout) and we want a single
  // active payments row at any time.
  await (service.from('payments' as never) as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => {
        in: (col: string, vals: string[]) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  })
    .update({ status: 'failed' })
    .eq('order_id', order.id)
    .in('status', ['pending', 'processing'])

  const profileRes = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const fullName =
    (profileRes.data as { full_name: string } | null)?.full_name ?? order.customer_email

  try {
    const result = await initiatePayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amountKes: Number(BigInt(order.total_minor) / 100n),
      customer: {
        email: order.customer_email,
        name: fullName,
        phone: order.customer_phone,
      },
      description: `Order ${order.order_number} (retry)`,
    })
    return NextResponse.json({
      provider: 'intasend',
      orderNumber: order.order_number,
      invoiceId: result.invoiceId,
      status: result.status ?? 'stk_pushed',
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'provider unavailable', detail: (e as Error).message },
      { status: 502 },
    )
  }
}
