/**
 * Pure helpers for the recently-viewed list. localStorage-only;
 * guest + signed-in alike. No server persistence — by design, "what I
 * just looked at" is browser-local context.
 */

export interface RecentlyViewedItem {
  productId: number
  slug: string
  /** ms since epoch when the user opened the PDP. */
  viewedAt: number
}

const DEFAULT_CAP = 10

/**
 * Insert a new view at the head of the list. If the product is already
 * present, move it to the head with a fresh `viewedAt`. Cap the list
 * to `cap` (default 10) most-recent entries.
 */
export function recordView(
  current: RecentlyViewedItem[],
  next: { productId: number; slug: string },
  now: number = Date.now(),
  cap: number = DEFAULT_CAP,
): RecentlyViewedItem[] {
  const filtered = current.filter((i) => i.productId !== next.productId)
  const newItem: RecentlyViewedItem = {
    productId: next.productId,
    slug: next.slug,
    viewedAt: now,
  }
  return [newItem, ...filtered].slice(0, cap)
}

/**
 * Get the most-recently-viewed items, excluding any whose productId
 * matches `excludeId` (so the PDP doesn't show its own product in the
 * "you recently viewed" strip).
 */
export function recentlyViewedExcluding(
  current: RecentlyViewedItem[],
  excludeId: number | null,
): RecentlyViewedItem[] {
  if (excludeId == null) return current
  return current.filter((i) => i.productId !== excludeId)
}
