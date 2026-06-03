/**
 * Verifies the timing-safe webhook challenge comparison can't be tricked
 * by length tricks and accepts only the exact configured value.
 *
 * The webhook handler refuses to do ANYTHING before this function says
 * ok:true, so a regression here is a security regression. Migration spec
 * (locked 2026-06-03): "Webhook signature verification mandatory on every
 * webhook. Missing verification means full project restart, not a patch."
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({
    INTASEND_WEBHOOK_CHALLENGE: 'the-canonical-secret-32-chars-long',
  }),
}))

import { verifyWebhookChallenge } from '@/lib/intasend/signature'

beforeEach(() => {
  // Module-scoped guard: a future contributor adding test-state leakage
  // notices a failure immediately.
})

describe('verifyWebhookChallenge', () => {
  it('accepts the exact configured challenge', () => {
    const r = verifyWebhookChallenge('the-canonical-secret-32-chars-long')
    expect(r.ok).toBe(true)
  })

  it('rejects any other value of the same length', () => {
    const r = verifyWebhookChallenge('THE-CANONICAL-SECRET-32-CHARS-LONG')
    expect(r.ok).toBe(false)
  })

  it('rejects a value of different length', () => {
    const r = verifyWebhookChallenge('shorter-value')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/mismatch/i)
  })

  it('rejects undefined', () => {
    const r = verifyWebhookChallenge(undefined)
    expect(r.ok).toBe(false)
  })

  it('rejects empty string', () => {
    const r = verifyWebhookChallenge('')
    expect(r.ok).toBe(false)
  })

  it('rejects a longer prefix that starts with the secret', () => {
    // Catches a length-leak regression — a naïve startsWith check would
    // accept this; our equal-length-aware compare must not.
    const r = verifyWebhookChallenge(
      'the-canonical-secret-32-chars-long-EXTRA-SUFFIX',
    )
    expect(r.ok).toBe(false)
  })
})
