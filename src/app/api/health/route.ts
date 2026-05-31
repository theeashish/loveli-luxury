/**
 * GET /api/health — liveness + dependency probe.
 *
 * Designed for an EXTERNAL uptime monitor (Better Stack, Pingdom,
 * UptimeRobot, Checkly, status.io) to hit on a regular cadence. Internal
 * monitoring is theatre — if your infrastructure is down, an internal
 * monitor can't tell you. The right pattern is an external service that
 * pings this endpoint and alerts when it stops responding 200.
 *
 * Two shapes:
 *
 *   GET /api/health
 *     Liveness only. Returns 200 if the function is reachable. Does NOT
 *     touch the DB or any provider. Use this for the *high-frequency*
 *     monitor probe (e.g. every minute) — it's the cheapest possible
 *     signal that the app is up at all.
 *
 *   GET /api/health?deep=1
 *     Liveness + dependency depth-check. Probes each money-critical
 *     dependency in parallel:
 *       - Supabase DB reachable (executes a trivial SELECT 1 via RPC)
 *       - server env validates (no missing required vars)
 *       - PayHero auth token is configured (does NOT hit PayHero —
 *         that would burn quota on the monitor; just presence-checks)
 *       - Upstash rate-limiter env is configured (presence-check)
 *     Returns 200 if all critical checks pass, 503 otherwise. Use this
 *     for the *lower-frequency* monitor probe (every 5 minutes) so it
 *     catches "the app is up but the DB is gone" without hammering
 *     either the DB or PayHero on every probe.
 *
 * Response shape (deep mode):
 *   { ok: true|false, status: "ok"|"degraded"|"down",
 *     checks: { db: {ok,ms}, env: {ok}, payhero: {ok}, upstash: {ok}, … },
 *     ts: ISO8601 }
 *
 * Cache: no-store. Monitors must always get a fresh response.
 *
 * Security: returns nothing sensitive — no env values, no DB row counts,
 * no secret lengths. Just pass/fail and probe timings.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getServerEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CheckResult = { ok: boolean; ms?: number; reason?: string }

async function checkDb(): Promise<CheckResult> {
  const t = Date.now()
  try {
    const svc = createServiceClient()
    // Trivial: select one row from a tiny, always-present table. RLS doesn't
    // apply (service-role client), and the row count is small enough that
    // this is sub-millisecond once the connection is warm.
    const r = await svc.from('config_settings').select('key').limit(1)
    const ms = Date.now() - t
    if (r.error) return { ok: false, ms, reason: r.error.message }
    return { ok: true, ms }
  } catch (e) {
    return { ok: false, ms: Date.now() - t, reason: (e as Error).message }
  }
}

function checkServerEnv(): CheckResult {
  try {
    getServerEnv()
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
}

function checkPayheroConfigured(): CheckResult {
  try {
    const env = getServerEnv()
    if (!env.PAYHERO_AUTH_TOKEN) return { ok: false, reason: 'PAYHERO_AUTH_TOKEN unset' }
    if (!env.PAYHERO_CHANNEL_ID_STK) return { ok: false, reason: 'PAYHERO_CHANNEL_ID_STK unset' }
    if (!env.PAYHERO_WEBHOOK_TOKEN) return { ok: false, reason: 'PAYHERO_WEBHOOK_TOKEN unset' }
    // We deliberately do NOT call PayHero here — that would consume API quota
    // every time the monitor probes. Presence-check is enough at this layer.
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
}

function checkUpstashConfigured(): CheckResult {
  try {
    const env = getServerEnv()
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      return { ok: false, reason: 'Upstash not configured (rate-limiter fails open)' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
}

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
}

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get('deep') === '1'

  if (!deep) {
    return NextResponse.json(
      { ok: true, status: 'ok', mode: 'liveness', ts: new Date().toISOString() },
      { status: 200, headers: noStoreHeaders },
    )
  }

  // Run all dependency probes in parallel so total latency is max(probe),
  // not sum(probe). The DB probe dominates; everything else is microseconds.
  const [db, env, payhero, upstash] = await Promise.all([
    checkDb(),
    Promise.resolve(checkServerEnv()),
    Promise.resolve(checkPayheroConfigured()),
    Promise.resolve(checkUpstashConfigured()),
  ])

  // Critical checks (failure = 503). DB and env are existential — the app
  // cannot serve any meaningful request without them. PayHero presence is
  // critical because no payment path works without it. Upstash absence
  // degrades to fail-open rate-limiting; we report it but don't 503 on it.
  const critical = [db.ok, env.ok, payhero.ok]
  const allCriticalOk = critical.every((x) => x)
  const status = allCriticalOk ? (upstash.ok ? 'ok' : 'degraded') : 'down'

  return NextResponse.json(
    {
      ok: allCriticalOk,
      status,
      mode: 'deep',
      checks: { db, env, payhero, upstash },
      ts: new Date().toISOString(),
    },
    { status: allCriticalOk ? 200 : 503, headers: noStoreHeaders },
  )
}
