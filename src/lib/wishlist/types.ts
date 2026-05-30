/**
 * Wishlist domain types. Pure; safe for both server and client.
 */

/** A single saved item. Exactly one of productId / bundleId is set. */
export interface WishlistItem {
  /** When this item was added (ms since epoch — JSON-safe). */
  addedAt: number
  /** Saved product id, or null when this is a bundle. */
  productId: number | null
  /** Saved bundle id, or null when this is a product. */
  bundleId: number | null
}

/** A WishlistItem narrowed to product-only. */
export interface WishlistProductItem extends WishlistItem {
  productId: number
  bundleId: null
}

/** A WishlistItem narrowed to bundle-only. */
export interface WishlistBundleItem extends WishlistItem {
  productId: null
  bundleId: number
}

/** Canonical key used to look up an item in the local store. */
export function wishlistKey(input: { productId?: number; bundleId?: number }): string {
  if (input.productId != null) return `product:${input.productId}`
  if (input.bundleId != null) return `bundle:${input.bundleId}`
  throw new Error('wishlistKey: neither productId nor bundleId provided')
}

/** Convert an item to its canonical key for set-membership checks. */
export function itemKey(item: WishlistItem): string {
  if (item.productId != null) return wishlistKey({ productId: item.productId })
  if (item.bundleId != null)  return wishlistKey({ bundleId: item.bundleId })
  throw new Error('itemKey: malformed wishlist item — neither id set')
}
