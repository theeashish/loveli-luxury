/**
 * /api/cron/commission-reconcile — GET and POST.
 *
 * Comp-plan safety net: finds every paid/commissionable order with NO
 * commission_ledger rows (e.g. a webhook ledger-write that failed
 * non-fatally) and backfills it via the idempotent `write_commission_ledger`
 * RPC. Bearer-secured with CRON_SECRET, identical to monthly-close. Orders
 * that already have commissions are skipped, so re-invocation is safe.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { reconcileMissingCommissions } from '@/lib/mlm/commission-reconcile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function authBearer(
  request: NextRequest,
): { ok: true } | { ok: false; res: NextResponse } {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 32) {
    return { ok: false, res: NextResponse.json({ error: 'misconfigured' }, { status: 500 }) }
  }
  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  const presented = auth.slice('Bearer '.length).trim()
  if (!constantTimeEqual(presented, expected)) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { ok: true }
}

async function run(): Promise<NextResponse> {
  const service = createServiceClient()
  const result = await reconcileMissingCommissions(service)
  return NextResponse.json(result)
}

export async function GET(request: NextRequest) {
  const a = authBearer(request)
  if (!a.ok) return a.res
  return run()
}

export async function POST(request: NextRequest) {
  const a = authBearer(request)
  if (!a.ok) return a.res
  return run()
}
