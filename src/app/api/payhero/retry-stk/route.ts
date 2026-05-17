/**
 * POST /api/payhero/retry-stk
 *
 * Re-fires the PayHero STK push for an EXISTING pending order owned by
 * the caller. Used by StkPushPanel "Try again" after the 75s timeout
 * (or a user-cancelled M-Pesa prompt) so the user can re-receive the
 * prompt without us creating a second order.
 *
 * Critical contract: this route MUST NOT create a new order. Same
 * `external_reference` (the order_number) → same PayHero transaction
 * dedup key → same webhook dedup key. The whole point of this route
 * is to defeat the double-deduction bug that arose when "Try again"
 * dropped the user back to the form and they re-submitted.
 *
 * Auth: caller must be signed in. Order must belong to caller. Order
 *       must still be in `pending` state. RLS on the read path enforces
 *       ownership; status is re-checked here to give a clean 409 if
 *       the webhook has already flipped it.
 *
 * Audit:   The shared `initiatePayment` dispatcher writes a fresh
 *          `payment_attempts` row on every call, so each retry is
 *          recorded in the audit trail automatically.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initiatePayment } from '@/lib/payments/dispatcher'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  orderNumber: z.string().min(1).max(64),
})

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { orderNumber } = parsed.data

  // Look up via service client and verify ownership explicitly — the
  // auth-bound client can't see `customer_email`/`customer_phone` on
  // some orders for distributors, and we want a uniform code path.
  const service = createServiceClient()
  const orderRes = await service
    .from('orders')
    .select(
      'id, order_number, status, total_minor, user_id, customer_email, customer_phone',
    )
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (orderRes.error) {
    return NextResponse.json(
      { error: 'Order lookup failed', detail: orderRes.error.message },
      { status: 500 },
    )
  }
  const order = orderRes.data as
    | {
        id: number
        order_number: string
        status: string
        total_minor: string | number
        user_id: string | null
        customer_email: string
        customer_phone: string | null
      }
    | null
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.status !== 'pending') {
    // Already paid / failed / cancelled / expired. The frontend will
    // see this and stop retrying.
    return NextResponse.json(
      { error: 'Order is no longer pending', status: order.status },
      { status: 409 },
    )
  }

  // Profile gives us the customer name (orders only carries email + phone).
  const profileRes = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }
  const fullName = (profileRes.data as { full_name: string }).full_name

  if (!order.customer_phone) {
    return NextResponse.json(
      { error: 'Order has no phone on file; cannot resend M-Pesa prompt.' },
      { status: 422 },
    )
  }

  const amountKes = Number(BigInt(order.total_minor) / 100n)

  let result
  try {
    result = await initiatePayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amountKes,
      customer: {
        email: order.customer_email,
        name: fullName,
        phone: order.customer_phone,
      },
      description: `Retry STK for ${order.order_number}`,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Payment provider unavailable', detail: (e as Error).message },
      { status: 502 },
    )
  }

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.order_number,
    ...result,
  })
}
