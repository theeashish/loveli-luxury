/**
 * /api/cron/reconcile-pending — GET (cron) and POST (ops).
 *
 * Belt-and-braces sweeper for missed provider webhooks. Scans recent
 * pending orders, asks the active provider for canonical status, and if
 * SUCCESS runs the full webhook chain (`applyPaymentSuccess`):
 * mark_order_paid → provision_distributor (signup) →
 * write_commission_ledger → sendOrderReceipt → audit.
 *
 * Defence layers (priority order):
 *   1. Webhook (push) — fast and free. Provider posts to /api/intasend/webhook.
 *   2. /api/intasend/status (pull) — self-heals during the customer's
 *      polling window while they wait on the success page.
 *   3. This cron (sweep) — for orders that miss both above.
 *
 * Phase 2 (2026-07-26): the IntaSend status probe is wired via
 * `reconcileByInvoiceId` (shared with `/api/intasend/status`). Scans
 * `orders` with status='pending', kind IN ('retail','distributor_signup'),
 * a `payments` row with a non-null invoice_id, older than
 * MIN_AGE_BEFORE_SWEEP_MS (so we don't race the customer's own poll or
 * the webhook that's very likely already in flight for a brand-new
 * order), and younger than MAX_AGE_MS (a pending order past that point
 * is almost certainly abandoned — the STALE_PENDING_MS window in
 * /api/checkout/init already expires it going forward; sweeping is a
 * bounded catch-up, not an unbounded historical scan).
 *
 * Auth: Bearer `CRON_SECRET` — matches /api/cron/monthly-close.
 *
 * Idempotent — `mark_order_paid` short-circuits on already-paid orders;
 * if two workers race (webhook + status + sweeper), the losers no-op.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { reconcileByInvoiceId } from '@/lib/payments/payment-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Don't sweep an order younger than this — give the webhook and the
 *  customer's own /api/intasend/status poll first crack at it. */
const MIN_AGE_BEFORE_SWEEP_MS = 3 * 60 * 1000
/** Don't bother sweeping an order this old — it's either already
 *  expired by /api/checkout/init's STALE_PENDING_MS or is a stuck
 *  historical record an admin should look at manually. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Cap per run so a large backlog can't turn one cron invocation into a
 *  Vercel function timeout. */
const MAX_ORDERS_PER_RUN = 50

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

export async function GET(req: NextRequest) {
  const auth = authBearer(req)
  if (!auth.ok) return auth.res

  const service = createServiceClient()

  const cutoffNew = new Date(Date.now() - MIN_AGE_BEFORE_SWEEP_MS).toISOString()
  const cutoffOld = new Date(Date.now() - MAX_AGE_MS).toISOString()

  // Orders old enough that the webhook/status-poll have had their shot,
  // not so old they're a stale historical record. Retail + signup only
  // — restock orders follow the same STK flow and are covered too since
  // `kind` isn't filtered further; every order kind uses `payments`.
  const pendingRes = await service
    .from('orders')
    .select('id, order_number, kind, created_at')
    .eq('status', 'pending')
    .lte('created_at', cutoffNew)
    .gte('created_at', cutoffOld)
    .order('created_at', { ascending: true })
    .limit(MAX_ORDERS_PER_RUN)

  if (pendingRes.error) {
    return NextResponse.json(
      { ok: false, error: `orders scan failed: ${pendingRes.error.message}` },
      { status: 500 },
    )
  }

  const candidates = (pendingRes.data ?? []) as Array<{
    id: number
    order_number: string
    kind: string
    created_at: string
  }>

  let paid = 0
  let unchanged = 0
  let failed = 0
  const errors: string[] = []

  for (const order of candidates) {
    const paymentRes = await service
      .from('payments')
      .select('invoice_id')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const invoiceId = (paymentRes.data as { invoice_id: string } | null)?.invoice_id
    if (!invoiceId) {
      unchanged++
      continue
    }

    try {
      const outcome = await reconcileByInvoiceId(invoiceId, order.id, order.kind, 'cron_sweep')
      if (outcome.state === 'complete') paid++
      else if (outcome.state === 'failed') failed++
      else unchanged++
    } catch (e) {
      errors.push(`order ${order.order_number}: ${(e as Error).message}`)
      unchanged++
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    paid,
    failed,
    unchanged,
    errors: errors.length > 0 ? errors : undefined,
  })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
