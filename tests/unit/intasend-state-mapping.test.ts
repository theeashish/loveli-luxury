/**
 * Locks in the IntaSend `state` → payments.status mapping. Regressions
 * here directly affect order lifecycle correctness.
 */
import { describe, it, expect } from 'vitest'
import { intasendStateToPaymentStatus } from '@/lib/intasend/types'

describe('intasendStateToPaymentStatus', () => {
  it('maps COMPLETE → complete', () => {
    expect(intasendStateToPaymentStatus('COMPLETE')).toBe('complete')
  })
  it('maps PAID (legacy alias) → complete', () => {
    expect(intasendStateToPaymentStatus('PAID')).toBe('complete')
  })
  it('maps FAILED → failed', () => {
    expect(intasendStateToPaymentStatus('FAILED')).toBe('failed')
  })
  it('maps CANCELLED → failed', () => {
    expect(intasendStateToPaymentStatus('CANCELLED')).toBe('failed')
  })
  it('maps EXPIRED → failed', () => {
    expect(intasendStateToPaymentStatus('EXPIRED')).toBe('failed')
  })
  it('maps PROCESSING → processing', () => {
    expect(intasendStateToPaymentStatus('PROCESSING')).toBe('processing')
  })
  it('is case-insensitive', () => {
    expect(intasendStateToPaymentStatus('complete')).toBe('complete')
  })
  it('treats unknown states as pending — never accidentally flips paid', () => {
    expect(intasendStateToPaymentStatus('SOMETHING_NEW')).toBe('pending')
    expect(intasendStateToPaymentStatus(undefined)).toBe('pending')
    expect(intasendStateToPaymentStatus('')).toBe('pending')
  })
})
