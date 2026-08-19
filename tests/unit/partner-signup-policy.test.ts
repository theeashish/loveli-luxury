import { describe, expect, it } from 'vitest'
import { MIN_PARTNER_SIGNUP_BOTTLES } from '@/lib/partners/signup-policy'

describe('partner signup product policy', () => {
  it('allows a single bottle and does not retain the old five-bottle gate', () => {
    expect(MIN_PARTNER_SIGNUP_BOTTLES).toBe(1)
    expect(MIN_PARTNER_SIGNUP_BOTTLES).toBeLessThan(5)
  })
})
