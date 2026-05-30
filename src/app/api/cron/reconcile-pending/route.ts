/**
 * /api/cron/reconcile-pending — GET (Vercel cron) and POST (ops).
 *
 * Belt-and-braces sweeper for missed PayHero webhooks. Scans recent
 * pending PayHero orders, asks PayHero for canonical status, and if
 * SUCCESS runs the full webhook chain (mark_order_paid →
 * provision_distributor (for signup orders) → write_commission_ledger →
 * record_v2_preview → sendOrderReceipt → audit).
 *
 * Defence layers (in priority order):
 *   1. Webhook (push) — fast and free. Configured in PayHero dashboard.
 *   2. /api/payhero/status (pull) — self-heals during the customer's
 *      polling window while they wait on the success page.
 *   3. This cron (sweep) — for orders that miss both above.
 *
 * Scheduling: NOT registered in vercel.json because Vercel Hobby caps
 * cron resolution at daily, which is too coarse for a pending-payment
 * sweeper. Trigger via Vercel Pro cron (`*\/5 * * * *`), an external
 * scheduler hitting this URL with the Bearer header, or by hand for ops
 * intervention. The endpoint is otherwise fully ready.
 *
 * Auth: Bearer `CRON_SECRET` — matches /api/cron/monthly-close.
 *
 * Scope: orders with status='pending', provider='payhero', a
 * payhero_checkout_reference, and created within the last 2 hours.
 * Capped at 25 orders per run so a backlog can't blow the function
 * budget or PayHero rate limits.
 *
 * Idempotent — `mark_order_paid` short-circuits on already-paid orders;
 * if two workers race (webhook + status + sweeper), the losers no-op.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { getTransactionStatus } from '@/lib/payhero/service'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ORDERS_PER_RUN = 25
const MAX_ORDER_AGE_MINUTES = 120

type ReconcileResult = {
  scanned: number
  paid: number
  unchanged: number
  failed: number
  errors: Array<{ orderId: number; reason: string }>
}

function authBearer(req: NextRequest):
  | { ok: true }
  | { ok: false; res: NextResponse } {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 32) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 },
      ),
    }
  }
  const header = req.headers.get('authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/)
  const token = m?.[1] ?? ''
  // Timing-safe compare (equal-length only); pad both sides.
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true }
}

async function run(): Promise<ReconcileResult> {
  const service = createServiceClient()
  const cutoff = new Date(
    Date.now() - MAX_ORDER_AGE_MINUTES * 60 * 1000,
  ).toISOString()

  const ordersRes = await service
    .from('orders')
    .select(
      'id, order_number, status, total_minor, kind, payment_provider, payhero_checkout_reference',
    )
    .eq('status', 'pending')
    .eq('payment_provider', 'payhero')
    .not('payhero_checkout_reference', 'is', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_ORDERS_PER_RUN)

  if (ordersRes.error) {
    throw new Error(`order lookup failed: ${ordersRes.error.message}`)
  }
  const orders = (ordersRes.data ?? []) as Array<{
    id: number
    order_number: string
    status: string
    total_minor: string | number
    kind: string
    payment_provider: string | null
    payhero_checkout_reference: string | null
  }>

  const result: ReconcileResult = {
    scanned: orders.length,
    paid: 0,
    unchanged: 0,
    failed: 0,
    errors: [],
  }

  for (const order of orders) {
    try {
      const ref = order.payhero_checkout_reference
      if (!ref) {
        result.unchanged += 1
        continue
      }
      const status = await getTransactionStatus(ref)

      if (status.status !== 'SUCCESS' || !status.success) {
        // Could be PENDING (customer hasn't completed STK yet), FAILED,
        // or QUEUED. Nothing for us to do — let the customer finish, the
        // webhook deliver, or the normal expiry cleanup run.
        result.unchanged += 1
        continue
      }

      // Amount sanity check — refuse if PayHero reports a different amount.
      const expectedMajor = Math.round(Number(order.total_minor) / 100)
      if (
        typeof status.amount === 'number' &&
        status.amount !== expectedMajor
      ) {
        result.failed += 1
        result.errors.push({
          orderId: order.id,
          reason: `amount mismatch: expected ${expectedMajor}, got ${status.amount}`,
        })
        continue
      }

      const applied = await applyPaymentSuccess(service, {
        orderId: order.id,
        orderKind: order.kind,
        payheroCheckoutReference: ref,
        mpesaReceipt:
          status.provider_reference ?? status.third_party_reference ?? null,
        externalReference: status.external_reference ?? null,
        source: 'cron_sweep',
      })
      if (!applied.paid) {
        result.failed += 1
        result.errors.push({
          orderId: order.id,
          reason: applied.error ?? 'apply failed',
        })
        continue
      }
      for (const warning of applied.warnings) {
        result.errors.push({ orderId: order.id, reason: `non-fatal: ${warning}` })
      }
      result.paid += 1
    } catch (err) {
      result.failed += 1
      result.errors.push({
        orderId: order.id,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

export async function GET(req: NextRequest) {
  const auth = authBearer(req)
  if (!auth.ok) return auth.res
  try {
    const result = await run()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
