import { describe, it, expect } from 'vitest'
import {
  addLine,
  clearLines,
  lineKey,
  removeLine,
  setQty,
} from '../../src/lib/cart/logic'
import type { BundleCartLine, CartLine, VariantCartLine } from '../../src/lib/cart/types'

const variantInput = (over: Partial<Omit<VariantCartLine, 'qty' | 'kind'>> = {}) =>
  ({
    kind: 'variant',
    variantId: 1,
    productSlug: 'rose-noir',
    name: 'Rose Noir',
    sizeMl: 30,
    unitPriceMinor: '400000',
    image: null,
    inventoryAtAdd: null,
    ...over,
  }) as const

const bundleInput = (over: Partial<Omit<BundleCartLine, 'qty' | 'kind'>> = {}) =>
  ({
    kind: 'bundle',
    bundleId: 7,
    slug: 'starter-a',
    name: 'Starter Pack A',
    unitPriceMinor: '1200000',
    image: null,
    alaCarteTotalMinor: '1520000',
    ...over,
  }) as const

const variantLine = (over: Partial<VariantCartLine> = {}): VariantCartLine => ({
  ...variantInput(),
  qty: 1,
  ...over,
})

const bundleLine = (over: Partial<BundleCartLine> = {}): BundleCartLine => ({
  ...bundleInput(),
  qty: 1,
  ...over,
})

describe('lineKey', () => {
  it('namespaces variant and bundle keys so id collisions are impossible', () => {
    expect(lineKey(variantInput({ variantId: 5 }))).toBe('variant:5')
    expect(lineKey(bundleInput({ bundleId: 5 }))).toBe('bundle:5')
    expect(lineKey(variantInput({ variantId: 5 }))).not.toBe(
      lineKey(bundleInput({ bundleId: 5 })),
    )
  })

  it('works on hydrated lines too', () => {
    expect(lineKey(variantLine({ variantId: 9 }))).toBe('variant:9')
    expect(lineKey(bundleLine({ bundleId: 9 }))).toBe('bundle:9')
  })
})

describe('addLine', () => {
  it('appends a fresh line', () => {
    const result = addLine([], variantInput(), 2)
    expect(result).toHaveLength(1)
    expect(result[0]?.qty).toBe(2)
  })

  it('sums qty when same kind+id is already present', () => {
    const start: CartLine[] = [variantLine({ qty: 2 })]
    const result = addLine(start, variantInput(), 3)
    expect(result).toHaveLength(1)
    expect(result[0]?.qty).toBe(5)
  })

  it('keeps variant and bundle with same numeric id separate', () => {
    const start: CartLine[] = [variantLine({ variantId: 5 })]
    const result = addLine(start, bundleInput({ bundleId: 5 }), 1)
    expect(result).toHaveLength(2)
  })

  it('caps a fresh add at inventoryAtAdd', () => {
    const result = addLine([], variantInput({ inventoryAtAdd: 3 }), 10)
    expect(result[0]?.qty).toBe(3)
  })

  it('caps a sum-add at inventoryAtAdd', () => {
    const start: CartLine[] = [variantLine({ qty: 2, inventoryAtAdd: 3 })]
    const result = addLine(start, variantInput({ inventoryAtAdd: 3 }), 10)
    expect(result[0]?.qty).toBe(3)
  })

  it('drops fresh adds when inventoryAtAdd is 0', () => {
    const result = addLine([], variantInput({ inventoryAtAdd: 0 }), 1)
    expect(result).toEqual([])
  })

  it('removes an existing line if inventory drops to 0 (cap collapses sum)', () => {
    const start: CartLine[] = [variantLine({ qty: 1, inventoryAtAdd: 0 })]
    const result = addLine(start, variantInput({ inventoryAtAdd: 0 }), 1)
    expect(result).toEqual([])
  })

  it('treats qty <= 0 or non-integer qty as a no-op', () => {
    const start: CartLine[] = [variantLine({ qty: 2 })]
    expect(addLine(start, variantInput(), 0)).toEqual(start)
    expect(addLine(start, variantInput(), -3)).toEqual(start)
    expect(addLine(start, variantInput(), 1.5)).toEqual(start)
  })

  it('does not mutate the input array', () => {
    const start: CartLine[] = [variantLine({ qty: 1 })]
    const snapshot = JSON.stringify(start)
    addLine(start, variantInput(), 4)
    expect(JSON.stringify(start)).toBe(snapshot)
  })

  it('bundles ignore inventory caps (no field on bundle lines)', () => {
    const start: CartLine[] = [bundleLine({ qty: 1 })]
    const result = addLine(start, bundleInput(), 99)
    expect(result[0]?.qty).toBe(100)
  })
})

describe('setQty', () => {
  it('updates qty for a matching line', () => {
    const start: CartLine[] = [variantLine({ qty: 1 }), bundleLine({ qty: 1 })]
    const result = setQty(start, 'variant:1', 7)
    const found = result.find((l) => lineKey(l) === 'variant:1')
    expect(found?.qty).toBe(7)
  })

  it('removes the line when qty <= 0', () => {
    const start: CartLine[] = [variantLine({ qty: 4 }), bundleLine({ qty: 1 })]
    expect(setQty(start, 'variant:1', 0)).toHaveLength(1)
    expect(setQty(start, 'variant:1', -1)).toHaveLength(1)
  })

  it('removes the line when qty is fractional / NaN (defensive)', () => {
    const start: CartLine[] = [variantLine({ qty: 4 })]
    expect(setQty(start, 'variant:1', 1.5)).toEqual([])
    expect(setQty(start, 'variant:1', Number.NaN)).toEqual([])
  })

  it('caps variant qty at inventoryAtAdd', () => {
    const start: CartLine[] = [variantLine({ qty: 1, inventoryAtAdd: 5 })]
    const result = setQty(start, 'variant:1', 99)
    expect(result[0]?.qty).toBe(5)
  })

  it('drops the line when inventoryAtAdd is 0', () => {
    const start: CartLine[] = [variantLine({ qty: 1, inventoryAtAdd: 0 })]
    expect(setQty(start, 'variant:1', 3)).toEqual([])
  })

  it('does not touch unrelated lines', () => {
    const start: CartLine[] = [variantLine({ qty: 1 }), bundleLine({ qty: 1 })]
    const result = setQty(start, 'variant:1', 9)
    const bundle = result.find((l) => l.kind === 'bundle')
    expect(bundle?.qty).toBe(1)
  })

  it('is a no-op for a missing key', () => {
    const start: CartLine[] = [variantLine({ qty: 1 })]
    expect(setQty(start, 'variant:999', 5)).toEqual(start)
  })
})

describe('removeLine', () => {
  it('removes the matching line', () => {
    const start: CartLine[] = [variantLine(), bundleLine()]
    const result = removeLine(start, 'variant:1')
    expect(result).toHaveLength(1)
    expect(result[0]?.kind).toBe('bundle')
  })

  it('is a no-op when the key is missing', () => {
    const start: CartLine[] = [variantLine()]
    expect(removeLine(start, 'bundle:999')).toEqual(start)
  })
})

describe('clearLines', () => {
  it('always returns an empty array', () => {
    expect(clearLines()).toEqual([])
  })
})
