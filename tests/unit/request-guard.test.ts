import { beforeEach, describe, expect, it, vi } from 'vitest'

const limiter = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/ratelimit', () => limiter)

import { enforceSensitiveRequest } from '@/lib/security/request-guard'

const options = {
  bucket: 'test-sensitive-route',
  limit: 8,
  windowSeconds: 60,
  requireSameOrigin: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('enforceSensitiveRequest', () => {
  it('rejects a mismatched browser origin before contacting the limiter', async () => {
    const response = await enforceSensitiveRequest(
      new Request('https://www.loveliluxury.com/api/checkout/init', {
        headers: { origin: 'https://attacker.example' },
      }),
      options,
    )

    expect(response?.status).toBe(403)
    expect(await response?.json()).toEqual({ error: 'origin not allowed' })
    expect(limiter.checkRateLimit).not.toHaveBeenCalled()
  })

  it('returns a no-store 429 with a retry hint when a shared limit is exceeded', async () => {
    limiter.checkRateLimit.mockResolvedValue({
      ok: false,
      limit: 8,
      remaining: 0,
      resetMs: 3200,
      reason: 'limited',
    })

    const response = await enforceSensitiveRequest(
      new Request('https://www.loveliluxury.com/api/checkout/init', {
        headers: { origin: 'https://www.loveliluxury.com', 'x-forwarded-for': '203.0.113.10' },
      }),
      options,
    )

    expect(response?.status).toBe(429)
    expect(response?.headers.get('Retry-After')).toBe('4')
    expect(response?.headers.get('Cache-Control')).toBe('no-store')
    expect(await response?.json()).toEqual({ error: 'too many requests' })
  })

  it('fails closed with 503 when the shared limiter is unavailable in production', async () => {
    limiter.checkRateLimit.mockResolvedValue({
      ok: false,
      limit: 8,
      remaining: 0,
      resetMs: 60_000,
      reason: 'unavailable',
    })

    const response = await enforceSensitiveRequest(
      new Request('https://www.loveliluxury.com/api/checkout/init'),
      options,
    )

    expect(response?.status).toBe(503)
    expect(await response?.json()).toEqual({ error: 'service temporarily unavailable' })
  })

  it('allows a same-origin request when the strict shared limit permits it', async () => {
    limiter.checkRateLimit.mockResolvedValue({
      ok: true,
      limit: 8,
      remaining: 7,
      resetMs: 0,
    })

    const response = await enforceSensitiveRequest(
      new Request('https://www.loveliluxury.com/api/checkout/init', {
        headers: { origin: 'https://www.loveliluxury.com', 'x-forwarded-for': '203.0.113.10' },
      }),
      options,
    )

    expect(response).toBeNull()
    expect(limiter.checkRateLimit).toHaveBeenCalledWith(
      'test-sensitive-route',
      '203.0.113.10',
      expect.objectContaining({ failureMode: 'closed-in-production' }),
    )
  })
})
