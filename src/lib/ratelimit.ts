import 'server-only'
import type { Duration } from '@upstash/ratelimit'

/**
 * Shared request limiter. Legacy callers retain the historic fail-open mode.
 * Sensitive routes opt into closed-in-production mode and reject requests if
 * their shared Redis limiter is unavailable in production.
 */
export type RateLimitFailureMode = 'open' | 'closed-in-production'

export type LimitResult = {
  ok: boolean
  limit: number
  remaining: number
  resetMs: number
  reason?: 'limited' | 'unavailable'
}

type RuntimeLimiter = {
  limit: (identifier: string) => Promise<{
    success: boolean
    limit: number
    remaining: number
    reset: number
  }>
}

const limiterCache = new Map<string, RuntimeLimiter>()

async function getLimiter(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RuntimeLimiter | null> {
  try {
    const { getServerEnv } = await import('./env')
    const env = getServerEnv()
    const url = env.UPSTASH_REDIS_REST_URL
    const token = env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null

    const key = `${bucket}:${limit}:${windowSeconds}`
    const cached = limiterCache.get(key)
    if (cached) return cached

    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s` as Duration),
      prefix: `rl:${bucket}`,
      analytics: false,
    }) as RuntimeLimiter
    limiterCache.set(key, limiter)
    return limiter
  } catch {
    return null
  }
}

/**
 * Check a rate limit for a named bucket. Sensitive routes can reject traffic
 * when the shared limiter is unavailable in production; other callers retain
 * availability-preserving fail-open behavior.
 */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  opts: {
    limit: number
    windowSeconds: number
    failureMode?: RateLimitFailureMode
  },
): Promise<LimitResult> {
  const allow: LimitResult = {
    ok: true,
    limit: opts.limit,
    remaining: opts.limit,
    resetMs: 0,
  }
  const unavailable: LimitResult = {
    ok: false,
    limit: opts.limit,
    remaining: 0,
    resetMs: opts.windowSeconds * 1000,
    reason: 'unavailable',
  }
  const failClosed =
    opts.failureMode === 'closed-in-production' && process.env.NODE_ENV === 'production'
  const limiter = await getLimiter(bucket, opts.limit, opts.windowSeconds)
  if (!limiter) return failClosed ? unavailable : allow

  try {
    const result = await limiter.limit(identifier)
    return {
      ok: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetMs: result.reset,
      ...(result.success ? {} : { reason: 'limited' as const }),
    }
  } catch {
    return failClosed ? unavailable : allow
  }
}

/** Best-effort client IP from proxy headers. Pure and unit-tested. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]
    if (first && first.trim()) return first.trim()
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
