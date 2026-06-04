/**
 * Locks the deploy-safety contract: when ANY of the four required IntaSend
 * env keys is missing, paymentProviderAvailability returns ok:false with
 * the missing key listed and a customer-safe message. When all four are
 * present, returns ok:true. The /checkout banner + /api/checkout/init 503
 * branch both key off this — a regression here would silently let
 * customers see 502s during cutover windows.
 */
import { describe, it, expect, vi } from 'vitest'

const RESET = {
  INTASEND_PUBLISHABLE_KEY: 'ISPubKey_test_abc',
  INTASEND_SECRET_TOKEN: 'ISSecretKey_test_xyz',
  INTASEND_WALLET_ID: 'wallet_123',
  INTASEND_WEBHOOK_CHALLENGE: 'a-very-long-challenge-value-32-chars',
}

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ ...RESET, ...(globalThis as { __envOverride?: Record<string, unknown> }).__envOverride }),
}))

import { paymentProviderAvailability } from '@/lib/payments/availability'

function withEnv(overrides: Record<string, unknown>, fn: () => void) {
  ;(globalThis as { __envOverride?: Record<string, unknown> }).__envOverride = overrides
  try {
    fn()
  } finally {
    ;(globalThis as { __envOverride?: Record<string, unknown> }).__envOverride = undefined
  }
}

describe('paymentProviderAvailability', () => {
  it('returns ok when every required env is present', () => {
    withEnv({}, () => {
      const r = paymentProviderAvailability()
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.provider).toBe('intasend')
    })
  })

  for (const key of [
    'INTASEND_PUBLISHABLE_KEY',
    'INTASEND_SECRET_TOKEN',
    'INTASEND_WALLET_ID',
    'INTASEND_WEBHOOK_CHALLENGE',
  ] as const) {
    it(`returns not-ok with ${key} in missing[] when ${key} is unset`, () => {
      withEnv({ [key]: undefined }, () => {
        const r = paymentProviderAvailability()
        expect(r.ok).toBe(false)
        if (!r.ok) {
          expect(r.missing).toContain(key)
          expect(r.customerMessage).toMatch(/upgrad/i)
        }
      })
    })
  }

  it('treats empty string as missing', () => {
    withEnv({ INTASEND_WALLET_ID: '' }, () => {
      const r = paymentProviderAvailability()
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.missing).toContain('INTASEND_WALLET_ID')
    })
  })

  it('lists multiple missing keys when several are absent', () => {
    withEnv({ INTASEND_PUBLISHABLE_KEY: undefined, INTASEND_WALLET_ID: '' }, () => {
      const r = paymentProviderAvailability()
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.missing).toContain('INTASEND_PUBLISHABLE_KEY')
        expect(r.missing).toContain('INTASEND_WALLET_ID')
      }
    })
  })
})
