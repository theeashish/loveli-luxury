/**
 * POST /api/payhero/reconcile
 *
 * Admin-triggered reconciliation. Calls PayHero's transaction-status
 * endpoint for an order that's still pending; if PayHero says the
 * payment succeeded but the webhook never landed (or arrived corrupt),
 * we force-flip the order through the same RPC chain the webhook would.
 *
 * Body: { orderId: number }
 * Auth: admin or superadmin only
 */

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { getTransactionStatus } from '@/lib/payhero/service'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  orderId: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json(
        { error: e.code },
        { status: e.code === 'UNAUTHENTICATED' ? 401 : 403 },
      )
    }
    throw e
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // 1. Load the order. database.ts is stale until types are regenerated
  // after migration 019 is applied — cast through unknown for the new
  // payhero_* columns.
  const orderRes = (await service
    .from('orders')
    .select(
      'id, order_number, status, total_minor, kind, payment_provider, payhero_checkout_reference',
    )
    .eq('id', parsed.data.orderId)
    .maybeSingle()) as unknown as {
    data: {
      id: number
      order_number: string
      status: string
      total_minor: string | number
      kind: string
      payment_provider: string | null
      payhero_checkout_reference: string | null
    } | null
    error: { message: string } | null
  }

  if (orderRes.error || !orderRes.data) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }
  const order = orderRes.data

  if (order.status !== 'pending') {
    return NextResponse.json({
      ok: true,
      message: `Order already in state '${order.status}', nothing to reconcile`,
    })
  }
  if (order.payment_provider !== 'payhero') {
    return NextResponse.json(
      { error: `Order provider is '${order.payment_provider}', not payhero` },
      { status: 400 },
    )
  }
  if (!order.payhero_checkout_reference) {
    return NextResponse.json(
      { error: 'Order has no PayHero checkout reference to reconcile against' },
      { status: 400 },
    )
  }

  // 2. Ask PayHero for the canonical status
  let status
  try {
    status = await getTransactionStatus(order.payhero_checkout_reference)
  } catch (e) {
    return NextResponse.json(
      { error: 'PayHero status lookup failed', detail: (e as Error).message },
      { status: 502 },
    )
  }

  // 3. If PayHero says SUCCESS and amount matches, run the same RPC chain
  // the webhook would. mark_order_paid is idempotent.
  if (status.status === 'SUCCESS' && status.success) {
    const expectedMajor = Math.round(Number(order.total_minor) / 100)
    if (typeof status.amount === 'number' && status.amount !== expectedMajor) {
      return NextResponse.json(
        {
          error: 'amount mismatch',
          expected: expectedMajor,
          received: status.amount,
        },
        { status: 409 },
      )
    }

    const applied = await applyPaymentSuccess(service, {
      orderId: order.id,
      orderKind: order.kind,
      payheroCheckoutReference: order.payhero_checkout_reference ?? '',
      mpesaReceipt:
        status.provider_reference ?? status.third_party_reference ?? null,
      externalReference: status.external_reference ?? null,
      source: 'reconcile_api',
    })
    if (!applied.paid) {
      return NextResponse.json(
        { error: applied.error ?? 'apply failed' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      applied.warnings.length > 0
        ? { ok: true, paid: true, warnings: applied.warnings }
        : { ok: true, paid: true },
    )
  }

  // 4. PayHero says non-success. Leave the order pending; report back.
  return NextResponse.json({
    ok: true,
    paid: false,
    payheroStatus: status.status,
    message: status.message,
  })
}
