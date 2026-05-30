/**
 * Pure-function tests for the wishlist mutation helpers.
 * No store, no I/O.
 */

import { describe, expect, it } from 'vitest'
import {
  addToList,
  isInList,
  mergeLists,
  removeFromList,
  toggleInList,
} from '../../src/lib/wishlist/logic'
import type { WishlistItem } from '../../src/lib/wishlist/types'

const item = (overrides: Partial<WishlistItem>): WishlistItem => ({
  addedAt: 1000,
  productId: null,
  bundleId: null,
  ...overrides,
})

const prod = (id: number, addedAt: number): WishlistItem =>
  item({ productId: id, addedAt })

const bnd = (id: number, addedAt: number): WishlistItem =>
  item({ bundleId: id, addedAt })

// ---------------------------------------------------------------------
// addToList
// ---------------------------------------------------------------------

describe('addToList', () => {
  it('adds a product to an empty list', () => {
    const out = addToList([], { productId: 7 }, 1234)
    expect(out).toHaveLength(1)
    expect(out[0]!.productId).toBe(7)
    expect(out[0]!.bundleId).toBeNull()
    expect(out[0]!.addedAt).toBe(1234)
  })

  it('adds a bundle to an empty list', () => {
    const out = addToList([], { bundleId: 3 }, 5678)
    expect(out).toHaveLength(1)
    expect(out[0]!.bundleId).toBe(3)
    expect(out[0]!.productId).toBeNull()
  })

  it('no-ops if the product is already in the list', () => {
    const existing = [prod(7, 1000)]
    const out = addToList(existing, { productId: 7 }, 9999)
    expect(out).toEqual(existing)
  })

  it('puts the new item at the head', () => {
    const existing = [prod(7, 1000)]
    const out = addToList(existing, { productId: 8 }, 2000)
    expect(out.map((i) => i.productId)).toEqual([8, 7])
  })

  it('keeps product 7 and bundle 7 as distinct entries', () => {
    const out1 = addToList([], { productId: 7 })
    const out2 = addToList(out1, { bundleId: 7 })
    expect(out2).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------
// removeFromList
// ---------------------------------------------------------------------

describe('removeFromList', () => {
  it('removes a matching product', () => {
    const out = removeFromList([prod(7, 1), prod(8, 2)], { productId: 7 })
    expect(out.map((i) => i.productId)).toEqual([8])
  })

  it('removes a matching bundle without touching products', () => {
    const list = [prod(7, 1), bnd(7, 2)]
    const out = removeFromList(list, { bundleId: 7 })
    expect(out).toHaveLength(1)
    expect(out[0]!.productId).toBe(7)
  })

  it('is a no-op when nothing matches', () => {
    const list = [prod(7, 1)]
    expect(removeFromList(list, { productId: 99 })).toEqual(list)
  })
})

// ---------------------------------------------------------------------
// toggleInList
// ---------------------------------------------------------------------

describe('toggleInList', () => {
  it('adds when absent', () => {
    const out = toggleInList([], { productId: 7 }, 100)
    expect(out).toHaveLength(1)
  })

  it('removes when present', () => {
    const out = toggleInList([prod(7, 1)], { productId: 7 })
    expect(out).toHaveLength(0)
  })

  it('toggle twice returns to original state', () => {
    const a = toggleInList([], { productId: 7 }, 100)
    const b = toggleInList(a, { productId: 7 })
    expect(b).toEqual([])
  })
})

// ---------------------------------------------------------------------
// isInList
// ---------------------------------------------------------------------

describe('isInList', () => {
  it('finds products', () => {
    expect(isInList([prod(7, 1)], { productId: 7 })).toBe(true)
    expect(isInList([prod(7, 1)], { productId: 8 })).toBe(false)
  })

  it('does not confuse products and bundles with same id', () => {
    expect(isInList([prod(7, 1)], { bundleId: 7 })).toBe(false)
    expect(isInList([bnd(7, 1)], { productId: 7 })).toBe(false)
  })
})

// ---------------------------------------------------------------------
// mergeLists
// ---------------------------------------------------------------------

describe('mergeLists', () => {
  it('de-dupes by key, keeping the earliest addedAt', () => {
    const local = [prod(7, 5000)]
    const server = [prod(7, 1000)]
    const merged = mergeLists(local, server)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.addedAt).toBe(1000)
  })

  it('keeps disjoint items from both sides', () => {
    const local = [prod(7, 1000)]
    const server = [prod(8, 2000)]
    const merged = mergeLists(local, server)
    expect(merged).toHaveLength(2)
  })

  it('returns most-recent first', () => {
    const local = [prod(7, 1000), prod(9, 9000)]
    const server = [prod(8, 5000)]
    const merged = mergeLists(local, server)
    expect(merged.map((i) => i.productId)).toEqual([9, 8, 7])
  })

  it('handles empty inputs', () => {
    expect(mergeLists([], [])).toEqual([])
    expect(mergeLists([prod(1, 100)], [])).toHaveLength(1)
    expect(mergeLists([], [prod(1, 100)])).toHaveLength(1)
  })
})
