import { describe, it, expect } from 'vitest'
import {
  kesToMinor,
  minorToKes,
  applyBasisPoints,
  sumMinor,
  formatKes,
  formatBasisPoints,
} from '../../src/lib/money'

describe('kesToMinor', () => {
  it('converts whole shillings to cents', () => {
    expect(kesToMinor(100)).toBe(10_000n)
    expect(kesToMinor(4_000)).toBe(400_000n)
    expect(kesToMinor(1_000_000)).toBe(100_000_000n)
  })

  it('rounds to avoid float artifacts', () => {
    expect(kesToMinor(0.1 + 0.2)).toBe(30n)
  })

  it('throws on non-finite input', () => {
    expect(() => kesToMinor(NaN)).toThrow()
    expect(() => kesToMinor(Infinity)).toThrow()
  })
})

describe('minorToKes', () => {
  it('converts cents back to KES', () => {
    expect(minorToKes(10_000n)).toBe(100)
    expect(minorToKes(400_000n)).toBe(4_000)
  })
})

describe('applyBasisPoints', () => {
  it('20% of Kes 4,000 = Kes 800', () => {
    expect(applyBasisPoints(kesToMinor(4_000), 2_000)).toBe(kesToMinor(800))
  })

  it('1.5% of Kes 50,000 = Kes 750', () => {
    expect(applyBasisPoints(kesToMinor(50_000), 150)).toBe(kesToMinor(750))
  })

  it('100% returns the original amount', () => {
    expect(applyBasisPoints(kesToMinor(123), 10_000)).toBe(kesToMinor(123))
  })

  it('0% returns zero', () => {
    expect(applyBasisPoints(kesToMinor(123), 0)).toBe(0n)
  })

  it('truncates toward zero', () => {
    // 1% of Kes 9.99 = Kes 0.0999. Truncates to Kes 0.09 (9 cents)
    expect(applyBasisPoints(999n, 100)).toBe(9n)
  })

  it('rejects negative basis points', () => {
    expect(() => applyBasisPoints(100n, -1)).toThrow()
  })

  it('rejects non-integer basis points', () => {
    expect(() => applyBasisPoints(100n, 1.5)).toThrow()
  })
})

describe('sumMinor', () => {
  it('sums an empty list to zero', () => {
    expect(sumMinor([])).toBe(0n)
  })

  it('sums a list of bigints', () => {
    expect(sumMinor([100n, 200n, 300n])).toBe(600n)
  })
})

describe('formatKes', () => {
  it('formats with thousands separator and KES symbol', () => {
    const formatted = formatKes(kesToMinor(1_234_567))
    expect(formatted).toContain('1,234,567')
    expect(formatted).toContain('KES')
  })
})

describe('formatBasisPoints', () => {
  it('20% from 2000bp', () => {
    expect(formatBasisPoints(2000)).toBe('20%')
  })

  it('1.5% from 150bp', () => {
    expect(formatBasisPoints(150)).toBe('1.5%')
  })

  it('0% from 0bp', () => {
    expect(formatBasisPoints(0)).toBe('0%')
  })
})
