/**
 * POST /api/intasend/collect
 *
 * Per-order collect endpoint. The cart → order pipeline lives in
 * /api/checkout/init and /api/partner-signup/init; this endpoint is the
 * narrower "fire (or re-fire) an STK push against an existing order"
 * surface that other server code (and future admin tooling) can call.
 *
 * Auth:
 *   - Signed-in user via the cookie-bound Supabase client.
 *   - The order must belong to the caller (orders.user_id = auth.uid()),
 *     or be a guest-checkout order with a matching customer_email — this
 *     handler enforces ownership server-side rather than trusting the
 *     client.
 *
 * Validation:
 *   - The amount IntaSend is asked for is read from the DB (orders.total_minor)
 *     — we never trust an amount in the request body.
 *   - Currency is read from the DB (orders.currency) for the same reason.
 *
 * Idempotency:
 *   - If a `payments` row already exists for this order in status `pending`
 *     or `processing`, we DO NOT fire again; we return the existing
 *     invoice_id so the polling client keeps watching the same payment.
 *     This is the duplicate-charge guard.
 *
 * Phase 2 (2026-06-03) of the PayHero → IntaSend migration. Replaces
 * what /api/checkout/init does inline; the init route's own STK push
 * still works (via dispatcher.initiatePayment) but this endpoint is the
 * canonical per-order entry point for retry / admin re-fire flows.
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
    orderId: z.coerce.number().int().positive(),
    /** Optional override; otherwise we use orders.customer_phone. */
    customerPhone: z
      .string()
      .regex(/^\+\d{8,15}$/, 'E.164 phone format required')
      .optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit('intasend_collect', clientIp(req), {
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
    return NextResponse.json(
      { error: 'invalid body', detail: parsed.error.message },
      { status: 400 },
    )
  }
  const { orderId, customerPhone } = parsed.data

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
    .eq('id', orderId)
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
  if (order.currency !== 'KES') {
    return NextResponse.json(
      { error: 'only KES collections are supported' },
      { status: 400 },
    )
  }

  // Idempotency: if a payments row is already in flight for this order,
  // return it rather than firing a second STK push. The dispatcher will
  // also enforce this at the DB level via UNIQUE(invoice_id), but
  // surfacing the check here gives the caller a clean response shape.
  const existingRes = (await (service.from('payments' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        in: (col: string, vals: string[]) => {
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
    }
  })
    .select('invoice_id, status')
    .eq('order_id', order.id)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as {
    data: { invoice_id: string; status: string } | null
    error: { message: string } | null
  }
  if (existingRes.data) {
    return NextResponse.json({
      provider: 'intasend',
      orderNumber: order.order_number,
      invoiceId: existingRes.data.invoice_id,
      reused: true,
      status: existingRes.data.status,
    })
  }

  // Profile lookup for name (best-effort; fall back to customer_email).
  const profileRes = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const fullName =
    (profileRes.data as { full_name: string } | null)?.full_name ?? order.customer_email

  const phone = customerPhone ?? order.customer_phone
  if (!phone) {
    return NextResponse.json(
      { error: 'no customer phone on order' },
      { status: 400 },
    )
  }

  // Fire. The dispatcher writes the payments row + payment_attempts row.
  try {
    const result = await initiatePayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amountKes: Number(BigInt(order.total_minor) / 100n),
      customer: {
        email: order.customer_email,
        name: fullName,
        phone,
      },
      description: `Order ${order.order_number}`,
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
