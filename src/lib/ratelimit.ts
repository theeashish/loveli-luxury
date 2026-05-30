import 'server-only'
import type { Duration } from '@upstash/ratelimit'

/**
 * Fail-open, no-op-without-config rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * are set; otherwise every call is allowed. ANY error (missing config,
 * network, Upstash outage) FALLS OPEN (allows the request) — a broken or
 * unconfigured limiter must never block legitimate traffic or break a route.
 *
 * env + the Upstash SDKs are imported lazily so this module is safe to import
 * in unit tests and adds nothing to a route's bundle until actually invoked.
 */

type LimitResult = { ok: boolean; limit: number; remaining: number; resetMs: number }

const limiterCache = new Map<string, unknown>()

async function getLimiter(bucket: string, limit: number, windowS: number): Promise<unknown | null> {
  try {
    const { getServerEnv } = await import('@/lib/env')
    const env = getServerEnv()
    const url = env.UPSTASH_REDIS_REST_URL
    const token = env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null

    const key = `${bucket}:${limit}:${windowS}`
    const cached = limiterCache.get(key)
    if (cached) return cached

    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const rl = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowS} s` as Duration),
      prefix: `rl:${bucket}`,
      analytics: false,
    })
    limiterCache.set(key, rl)
    return rl
  } catch {
    return null
  }
}

/**
 * Check a rate limit for `identifier` (typically the client IP) under a named
 * bucket. Returns ok:true (allow) when unconfigured or on any error.
 */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  opts: { limit: number; windowSeconds: number },
): Promise<LimitResult> {
  const allow: LimitResult = { ok: true, limit: opts.limit, remaining: opts.limit, resetMs: 0 }
  try {
    const limiter = await getLimiter(bucket, opts.limit, opts.windowSeconds)
    if (!limiter) return allow
    const rl = limiter as {
      limit: (id: string) => Promise<{ success: boolean; limit: number; remaining: number; reset: number }>
    }
    const res = await rl.limit(identifier)
    return { ok: res.success, limit: res.limit, remaining: res.remaining, resetMs: res.reset }
  } catch {
    return allow
  }
}

/** Best-effort client IP from request headers. Pure — unit-tested. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]
    if (first && first.trim()) return first.trim()
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
