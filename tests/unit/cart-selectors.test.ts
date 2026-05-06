import { describe, it, expect } from 'vitest'
import {
  bundleSavingsMinor,
  isEmpty,
  lineTotalMinor,
  subtotalMinor,
  totalBundleSavingsMinor,
  totalQty,
} from '../../src/lib/cart/selectors'
import type { BundleCartLine, CartLine, VariantCartLine } from '../../src/lib/cart/types'

const v = (over: Partial<VariantCartLine> = {}): VariantCartLine => ({
  kind: 'variant',
  variantId: 1,
  productSlug: 'rose-noir',
  name: 'Rose Noir',
  sizeMl: 30,
  unitPriceMinor: '400000',
  qty: 1,
  image: null,
  inventoryAtAdd: null,
  ...over,
})

const b = (over: Partial<BundleCartLine> = {}): BundleCartLine => ({
  kind: 'bundle',
  bundleId: 7,
  slug: 'starter-a',
  name: 'Starter Pack A',
  unitPriceMinor: '1200000',
  qty: 1,
  image: null,
  alaCarteTotalMinor: '1520000',
  ...over,
})

describe('lineTotalMinor', () => {
  it('multiplies unit price by qty as bigint', () => {
    expect(lineTotalMinor(v({ unitPriceMinor: '400000', qty: 3 }))).toBe(1_200_000n)
  })

  it('handles values larger than Number.MAX_SAFE_INTEGER', () => {
    expect(
      lineTotalMinor(v({ unitPriceMinor: '9007199254740993', qty: 2 })),
    ).toBe(18_014_398_509_481_986n)
  })
})

describe('totalQty / isEmpty', () => {
  it('sums qty across mixed kinds', () => {
    const state = { lines: [v({ qty: 2 }), b({ qty: 3 })] satisfies CartLine[] }
    expect(totalQty(state)).toBe(5)
    expect(isEmpty(state)).toBe(false)
  })

  it('is empty for [] / qty 0', () => {
    expect(totalQty({ lines: [] })).toBe(0)
    expect(isEmpty({ lines: [] })).toBe(true)
  })
})

describe('subtotalMinor', () => {
  it('sums line totals as bigint', () => {
    const state = {
      lines: [
        v({ unitPriceMinor: '400000', qty: 2 }), //   800,000
        b({ unitPriceMinor: '1200000', qty: 1 }), // 1,200,000
      ] satisfies CartLine[],
    }
    expect(subtotalMinor(state)).toBe(2_000_000n)
  })

  it('returns 0n on empty cart', () => {
    expect(subtotalMinor({ lines: [] })).toBe(0n)
  })
})

describe('bundleSavingsMinor', () => {
  it('returns 0n when no à-la-carte snapshot is present', () => {
    expect(bundleSavingsMinor(b({ alaCarteTotalMinor: null }))).toBe(0n)
  })

  it('computes (alaCarte - paid) per qty when bundle is cheaper', () => {
    const line = b({ unitPriceMinor: '1200000', alaCarteTotalMinor: '1520000', qty: 2 })
    expect(bundleSavingsMinor(line)).toBe(640_000n) // (1_520_000 - 1_200_000) * 2
  })

  it('floors at 0 when bundle is at par or above à-la-carte', () => {
    expect(
      bundleSavingsMinor(b({ unitPriceMinor: '1520000', alaCarteTotalMinor: '1520000' })),
    ).toBe(0n)
    expect(
      bundleSavingsMinor(b({ unitPriceMinor: '1600000', alaCarteTotalMinor: '1520000' })),
    ).toBe(0n)
  })
})

describe('totalBundleSavingsMinor', () => {
  it('sums savings across all bundle lines, ignoring variants', () => {
    const state = {
      lines: [
        v({ qty: 5 }), // ignored
        b({ unitPriceMinor: '1200000', alaCarteTotalMinor: '1520000', qty: 1 }), // 320_000
        b({
          bundleId: 9,
          unitPriceMinor: '900000',
          alaCarteTotalMinor: '1100000',
          qty: 2,
        }), // 400_000
      ] satisfies CartLine[],
    }
    expect(totalBundleSavingsMinor(state)).toBe(720_000n)
  })

  it('returns 0n on cart with no bundles', () => {
    expect(totalBundleSavingsMinor({ lines: [v()] })).toBe(0n)
  })
})
