import { describe, it, expect } from 'vitest'
import { clientIp } from '@/lib/ratelimit'

function reqWith(headers: Record<string, string>): Request {
  return new Request('https://example.com', { headers })
}

describe('clientIp', () => {
  it('takes the first IP from x-forwarded-for', () => {
    expect(clientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip when no forwarded-for', () => {
    expect(clientIp(reqWith({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
  })

  it('returns "unknown" when no IP headers are present', () => {
    expect(clientIp(reqWith({}))).toBe('unknown')
  })
})
