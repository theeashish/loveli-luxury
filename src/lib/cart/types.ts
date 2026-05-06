/**
 * Cart types.
 *
 * Money rule: prices on cart lines are decimal-string minor units, parsed back
 * into BigInt by selectors. JSON.stringify cannot serialise bigints, and the
 * cart is persisted to localStorage as JSON.
 */

export type VariantCartLine = {
  kind: 'variant'
  variantId: number
  productSlug: string
  name: string
  sizeMl: number
  unitPriceMinor: string
  qty: number
  image: string | null
  /**
   * Inventory snapshot taken at add-time. Used as an advisory cap on the
   * client; checkout re-validates against the live row before payment.
   * `null` means inventory tracking is unknown for this variant — no cap.
   */
  inventoryAtAdd: number | null
}

export type BundleCartLine = {
  kind: 'bundle'
  bundleId: number
  slug: string
  name: string
  unitPriceMinor: string
  qty: number
  image: string | null
  /**
   * Sum of contained variants × their retail prices, captured at add-time.
   * Used to render "you save Kes X" without re-fetching the bundle. May be
   * `null` if the source DTO didn't carry it.
   */
  alaCarteTotalMinor: string | null
}

export type CartLine = VariantCartLine | BundleCartLine

export type CartLineInput =
  | Omit<VariantCartLine, 'qty'>
  | Omit<BundleCartLine, 'qty'>

export type CartState = {
  cartId: string
  lines: CartLine[]
}
