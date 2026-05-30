/**
 * Pure tests for the recently-viewed list helpers. No store; no DOM.
 */

import { describe, expect, it } from 'vitest'
import {
  recentlyViewedExcluding,
  recordView,
  type RecentlyViewedItem,
} from '../../src/lib/recently-viewed/logic'

const view = (productId: number, slug: string, viewedAt: number): RecentlyViewedItem => ({
  productId,
  slug,
  viewedAt,
})

describe('recordView', () => {
  it('adds the first view at the head', () => {
    const out = recordView([], { productId: 1, slug: 'one' }, 100)
    expect(out).toEqual([view(1, 'one', 100)])
  })

  it('moves a repeat view to the head with a fresh viewedAt', () => {
    const existing: RecentlyViewedItem[] = [
      view(1, 'one', 100),
      view(2, 'two', 200),
    ]
    const out = recordView(existing, { productId: 1, slug: 'one' }, 500)
    expect(out.map((i) => i.productId)).toEqual([1, 2])
    expect(out[0]!.viewedAt).toBe(500)
  })

  it('caps at 10 by default', () => {
    let list: RecentlyViewedItem[] = []
    for (let i = 1; i <= 15; i++) {
      list = recordView(list, { productId: i, slug: `p-${i}` }, i)
    }
    expect(list).toHaveLength(10)
    expect(list[0]!.productId).toBe(15)
    expect(list[9]!.productId).toBe(6)
  })

  it('honours a custom cap', () => {
    let list: RecentlyViewedItem[] = []
    for (let i = 1; i <= 5; i++) {
      list = recordView(list, { productId: i, slug: `p-${i}` }, i, 3)
    }
    expect(list).toHaveLength(3)
    expect(list.map((i) => i.productId)).toEqual([5, 4, 3])
  })

  it('does not duplicate when re-viewing the same slug different times', () => {
    let list: RecentlyViewedItem[] = []
    list = recordView(list, { productId: 1, slug: 'one' }, 100)
    list = recordView(list, { productId: 1, slug: 'one' }, 200)
    list = recordView(list, { productId: 1, slug: 'one' }, 300)
    expect(list).toHaveLength(1)
    expect(list[0]!.viewedAt).toBe(300)
  })
})

describe('recentlyViewedExcluding', () => {
  it('returns the full list when excludeId is null', () => {
    const list = [view(1, 'one', 100), view(2, 'two', 200)]
    expect(recentlyViewedExcluding(list, null)).toEqual(list)
  })

  it('filters out the excluded productId', () => {
    const list = [view(1, 'one', 100), view(2, 'two', 200)]
    expect(recentlyViewedExcluding(list, 1)).toEqual([view(2, 'two', 200)])
  })

  it('returns the list unchanged when excludeId is not present', () => {
    const list = [view(1, 'one', 100)]
    expect(recentlyViewedExcluding(list, 99)).toEqual(list)
  })
})
