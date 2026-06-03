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
 * Phase 0 status (2026-06-03):
 *   PayHero has been removed. The IntaSend status probe lands in Phase 2
 *   of the migration. Until then this endpoint short-circuits — it
 *   verifies the bearer secret, reports the deferred state, and exits
 *   without scanning. Vercel cron / ops will see a successful 200 with
 *   `paid: 0, scanned: 0, note: 'sweeper deferred until Phase 2'`.
 *
 * Auth: Bearer `CRON_SECRET` — matches /api/cron/monthly-close.
 *
 * Idempotent — `mark_order_paid` will short-circuit on already-paid
 * orders when Phase 2 lands; if two workers race (webhook + status +
 * sweeper), the losers no-op.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  // Phase 0 stub. When Phase 2 lands, replace this body with the IntaSend
  // status-probe loop: scan recent `orders` with status='pending' +
  // provider='intasend' + a payments.invoice_id, call the IntaSend
  // status endpoint per order, and on SUCCESS feed the result into
  // applyPaymentSuccess() with source='cron_sweep'.
  return NextResponse.json({
    ok: true,
    scanned: 0,
    paid: 0,
    unchanged: 0,
    failed: 0,
    note: 'Provider status probe deferred until Phase 2 of the PayHero → IntaSend migration. Bearer auth is live; the loop body is intentionally empty.',
  })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
