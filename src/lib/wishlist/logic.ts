/**
 * Pure wishlist mutation helpers. Server-side sync logic and the
 * Zustand store both share these, which keeps the source-of-truth
 * for "is this saved" in one testable function.
 */

import type { WishlistItem } from './types'
import { itemKey, wishlistKey } from './types'

/** Add (or no-op if already present) an item. Sorts most-recent-first. */
export function addToList(
  current: WishlistItem[],
  add: { productId?: number; bundleId?: number },
  now: number = Date.now(),
): WishlistItem[] {
  const targetKey = wishlistKey(add)
  if (current.some((i) => itemKey(i) === targetKey)) return current
  const next: WishlistItem = {
    addedAt: now,
    productId: add.productId ?? null,
    bundleId: add.bundleId ?? null,
  }
  return [next, ...current]
}

/** Remove an item by key. No-op if absent. */
export function removeFromList(
  current: WishlistItem[],
  remove: { productId?: number; bundleId?: number },
): WishlistItem[] {
  const targetKey = wishlistKey(remove)
  return current.filter((i) => itemKey(i) !== targetKey)
}

/** Toggle: remove if present, add if absent. */
export function toggleInList(
  current: WishlistItem[],
  target: { productId?: number; bundleId?: number },
  now: number = Date.now(),
): WishlistItem[] {
  const targetKey = wishlistKey(target)
  return current.some((i) => itemKey(i) === targetKey)
    ? removeFromList(current, target)
    : addToList(current, target, now)
}

/** Membership predicate. */
export function isInList(
  current: WishlistItem[],
  target: { productId?: number; bundleId?: number },
): boolean {
  const targetKey = wishlistKey(target)
  return current.some((i) => itemKey(i) === targetKey)
}

/**
 * Merge two wishlist arrays (e.g. localStorage + DB on sign-in).
 * - De-duplicates by key.
 * - Keeps the earliest `addedAt` (so "saved 2 weeks ago" survives
 *   the merge instead of getting reset to now).
 * - Returns the merged list sorted most-recent-first.
 */
export function mergeLists(
  a: WishlistItem[],
  b: WishlistItem[],
): WishlistItem[] {
  const byKey = new Map<string, WishlistItem>()
  for (const item of [...a, ...b]) {
    const k = itemKey(item)
    const existing = byKey.get(k)
    if (!existing || item.addedAt < existing.addedAt) {
      byKey.set(k, item)
    }
  }
  return Array.from(byKey.values()).sort((x, y) => y.addedAt - x.addedAt)
}
