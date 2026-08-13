import 'server-only'

import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/ratelimit'

type SensitiveRequestOptions = {
  bucket: string
  limit: number
  windowSeconds: number
  requireSameOrigin?: boolean
}

function requestClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]
    if (first && first.trim()) return first.trim()
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function requestOriginMatches(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

function securityResponse(
  body: { error: string },
  status: number,
  retryAfterSeconds?: number,
): NextResponse {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  })
  if (retryAfterSeconds) headers.set('Retry-After', String(retryAfterSeconds))
  return NextResponse.json(body, { status, headers })
}

/**
 * Strict guard for sensitive routes. In production, a missing or unavailable
 * shared limiter rejects traffic instead of silently failing open. For browser
 * writes, any supplied Origin must match the request origin.
 */
export async function enforceSensitiveRequest(
  request: Request,
  options: SensitiveRequestOptions,
): Promise<NextResponse | null> {
  if (options.requireSameOrigin && !requestOriginMatches(request)) {
    console.warn('[security] origin rejected', { bucket: options.bucket })
    return securityResponse({ error: 'origin not allowed' }, 403)
  }

  const result = await checkRateLimit(options.bucket, requestClientIp(request), {
    limit: options.limit,
    windowSeconds: options.windowSeconds,
    failureMode: 'closed-in-production',
  })
  if (result.ok) return null

  if (result.reason === 'unavailable') {
    console.error('[security] strict rate limit unavailable', { bucket: options.bucket })
    return securityResponse({ error: 'service temporarily unavailable' }, 503)
  }

  const retryAfterSeconds = Math.max(1, Math.ceil(result.resetMs / 1000))
  console.warn('[security] rate limit exceeded', { bucket: options.bucket })
  return securityResponse({ error: 'too many requests' }, 429, retryAfterSeconds)
}
