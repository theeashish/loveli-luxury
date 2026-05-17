/**
 * GET /api/payhero/status?ref=<order_number>
 *
 * Frontend-poll endpoint. Returns the ORDER state (paid / pending /
 * cancelled / refunded) — NOT the PayHero state. The webhook is what
 * flips order state; this endpoint only reads.
 *
 * Auth: caller must own the order (RLS via the user-scoped client).
 *
 * Rate limit: the client polls every ~2s for up to 60s; that's ~30
 * hits per checkout. Acceptable inline; if abuse appears, push behind
 * the rate limiter in Phase A6.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  // user-scoped read; RLS enforces "user owns this order".
  // TODO(types): regenerate database.ts post-migration-019; until then
  // the maybeSingle() generic resolves to `never` because the orders
  // type doesn't include the new payhero_* columns. Narrow manually.
  const r = (await supabase
    .from('orders')
    .select('id, order_number, status, kind, paid_at, total_minor, currency')
    .eq('order_number', ref)
    .eq('user_id', session.user.id)
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

  if (r.error) {
    return NextResponse.json({ error: r.error.message }, { status: 500 })
  }
  if (!r.data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json({
    orderNumber: r.data.order_number,
    status: r.data.status,
    kind: r.data.kind,
    paidAt: r.data.paid_at,
    totalMinor: String(r.data.total_minor),
    currency: r.data.currency,
  })
}
