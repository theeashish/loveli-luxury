/**
 * /api/cron/heartbeat — Vercel cron → Sentry check-in for liveness alerting.
 *
 * Pairs with /api/health to give the platform an EXTERNALLY-watched heartbeat
 * without requiring the owner to sign up for a third-party uptime monitor
 * before launch. The reasoning:
 *
 *   • `/api/health` is the *probe* — it returns 200 (or 503 if a dependency
 *     is down) when something else asks.
 *   • This route is the *clock* — Vercel cron calls it every 15 minutes,
 *     it runs the deep health check, and reports the result to Sentry's
 *     cron-monitoring service via `Sentry.captureCheckIn`.
 *   • Sentry alerts (via the owner's existing Sentry alert rules) when
 *     either (a) the check-in reports `error`, or (b) the check-in is
 *     missed entirely for more than `checkinMargin` minutes. (b) is the
 *     "is the *site* up?" signal — if Vercel functions are dead, this
 *     route never runs, no check-in arrives, Sentry pages.
 *
 * The check-in goes to a *separate* SaaS (Sentry), so this is genuinely
 * external monitoring even though no extra service was set up. When the
 * owner does wire a dedicated uptime monitor (Better Stack, Pingdom, etc.)
 * they pair with `/api/health` and this route becomes redundant — that's
 * fine, leave both running.
 *
 * Auth: bearer CRON_SECRET, identical pattern to the other cron routes.
 * Vercel cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
 *
 * Cadence (current): "0 9 * * *" — once daily at 09:00 UTC. This is the
 * tightest cadence Vercel's Hobby plan allows. When the project moves to
 * Vercel Pro, swap to a tighter cadence (e.g. every 15 minutes) — update
 * BOTH `vercel.json` AND the `SCHEDULE_CRON` constant below in lockstep so
 * Sentry's missed-check-in detector knows the expected interval. The route
 * code is plan-agnostic; only the cron schedule changes.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getServerEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MONITOR_SLUG = 'site-liveness'
const SCHEDULE_CRON = '0 9 * * *'

function authBearer(request: NextRequest):
  | { ok: true }
  | { ok: false; res: NextResponse } {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 32) {
    return {
      ok: false,
      res: NextResponse.json({ error: 'CRON_SECRET unset' }, { status: 500 }),
    }
  }
  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!provided) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { ok: true }
}

export async function GET(request: NextRequest) {
  const auth = authBearer(request)
  if (!auth.ok) return auth.res

  // Sentry check-in: mark this run as started so a missed run still shows as
  // missed (not just "never reported"). The schedule + checkinMargin tells
  // Sentry's monitor what cadence to expect.
  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: MONITOR_SLUG, status: 'in_progress' },
    {
      schedule: { type: 'crontab', value: SCHEDULE_CRON },
      checkinMargin: 30, // alert if the daily heartbeat is >30 min late
      maxRuntime: 2, // alert if the heartbeat hasn't finished in 2 min
      timezone: 'UTC',
    },
  )

  // Re-do the deep health check inline rather than fetch /api/health — saves
  // one round-trip and avoids the awkward self-call from a serverless function.
  const startedAt = Date.now()
  let ok = true
  let reason: string | undefined

  try {
    const env = getServerEnv()
    if (
      !env.INTASEND_SECRET_TOKEN ||
      !env.INTASEND_WEBHOOK_CHALLENGE ||
      !env.INTASEND_WALLET_ID
    ) {
      ok = false
      reason = 'IntaSend env incomplete'
    }
    // Quick DB ping. If the DB is gone, the heartbeat reports `error` and
    // Sentry alerts — separate signal from "the entire deployment is down."
    const { createServiceClient } = await import('@/lib/supabase/service')
    const svc = createServiceClient()
    const r = await svc.from('config_settings').select('key').limit(1)
    if (r.error) {
      ok = false
      reason = `DB: ${r.error.message}`
    }
  } catch (e) {
    ok = false
    reason = (e as Error).message
  }

  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: MONITOR_SLUG,
    status: ok ? 'ok' : 'error',
    duration: (Date.now() - startedAt) / 1000,
  })

  return NextResponse.json(
    { ok, monitor: MONITOR_SLUG, schedule: SCHEDULE_CRON, durationMs: Date.now() - startedAt, reason },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
