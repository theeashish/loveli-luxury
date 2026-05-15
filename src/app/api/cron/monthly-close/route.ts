/**
 * /api/cron/monthly-close — GET and POST.
 *
 * Bearer-secured entry point that an external scheduler (Vercel cron,
 * pg_cron, GitHub Actions, etc.) invokes once a month to run the
 * compute-and-draft pipeline for the previous calendar month. The same
 * pipeline runs synchronously from /admin/close for ad-hoc periods.
 *
 * GET:     For Vercel cron, which sends GETs with the
 *          `Authorization: Bearer <CRON_SECRET>` header automatically.
 *          No body — always runs "last full UTC month" with draft = true.
 *
 * POST:    For ad-hoc invocations from ops tooling. Takes the same auth
 *          header plus an optional JSON body
 *          { year?: number, month?: number, draft?: boolean } to target
 *          a specific period.
 *
 * Result:  JSON { close: CloseResult, draft?: DraftPayoutsResult }
 *
 * Idempotency:
 *   The underlying RPCs upsert snapshots/salaries and respect locked
 *   payouts, so re-invocation is safe. Payout-draft creation is gated by
 *   the UNIQUE(distributor_id, year, month) constraint on payouts.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
  draftPayoutsForPeriod,
  lastFullUtcMonth,
  runCloseForPeriod,
} from '@/lib/close/orchestrate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    year: z.number().int().min(2024).max(2099).optional(),
    month: z.number().int().min(1).max(12).optional(),
    draft: z.boolean().optional(),
  })
  .strict()

function authBearer(request: NextRequest):
  | { ok: true }
  | { ok: false; res: NextResponse } {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 32) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'misconfigured' }, { status: 500 }),
    }
  }

  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }
  const presented = auth.slice('Bearer '.length).trim()
  if (!constantTimeEqual(presented, expected)) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true }
}

async function runWithPeriod(opts: {
  year?: number
  month?: number
  draft?: boolean
}): Promise<NextResponse> {
  const fallback = lastFullUtcMonth()
  const year = opts.year ?? fallback.year
  const month = opts.month ?? fallback.month
  const draft = opts.draft ?? true

  const close = await runCloseForPeriod(year, month, null)
  const draftResult = draft
    ? await draftPayoutsForPeriod(year, month, null)
    : null

  return NextResponse.json({
    period: `${year}-${String(month).padStart(2, '0')}`,
    close,
    draft: draftResult,
  })
}

export async function GET(request: NextRequest) {
  const a = authBearer(request)
  if (!a.ok) return a.res
  return runWithPeriod({})
}

export async function POST(request: NextRequest) {
  const a = authBearer(request)
  if (!a.ok) return a.res

  // Body is optional; an empty POST defaults to "last full UTC month" + draft.
  let parsed: z.infer<typeof bodySchema> = {}
  if (request.headers.get('content-length') !== '0') {
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      raw = {}
    }
    if (raw && Object.keys(raw as object).length > 0) {
      const result = bodySchema.safeParse(raw)
      if (!result.success) {
        return NextResponse.json(
          { error: 'invalid body', issues: result.error.flatten() },
          { status: 400 },
        )
      }
      parsed = result.data
    }
  }

  return runWithPeriod(parsed)
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
