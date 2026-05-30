/**
 * Catalog DTOs returned from server queries to the client.
 *
 * Money rule: prices cross the wire as decimal-string minor units. The
 * BigInt money helpers in src/lib/money.ts parse them back when arithmetic is
 * needed. Never JSON.stringify a bigint directly.
 */

export type ImageDto = {
  id: number
  storagePrefix: string
  alt: string | null
  position: number
  width: number | null
  height: number | null
  isPrimary: boolean
}

export type VariantDto = {
  id: number
  productId: number
  sku: string
  sizeMl: number
  retailPriceMinor: string | number
  distributorPriceMinor: string | number
  weightG: number | null
  inventoryQty: number
  isActive: boolean
}

export type CategoryDto = {
  id: number
  slug: string
  name: string
  parentId: number | null
  position: number
  isActive: boolean
}

export type ProductSummaryDto = {
  id: number
  slug: string
  name: string
  categoryId: number | null
  isActive: boolean
  primaryImage: ImageDto | null
  minRetailPriceMinor: string | null
}

export type FragranceMetaDto = {
  topNotes: string[]
  heartNotes: string[]
  baseNotes: string[]
  /** e.g. "8–10 hours" */
  longevity: string | null
  /** e.g. "close", "moderate", "strong" */
  projection: string | null
  /** Suitability note for East African climate. */
  climateNote: string | null
  /** e.g. ["Office", "Evening", "Date"] */
  occasions: string[]
  /** Editorial story, may contain newlines. */
  story: string | null
  scentFamily: string | null
  inspiredBy: string | null
}

export type ProductDto = {
  id: number
  slug: string
  name: string
  description: string | null
  categoryId: number | null
  isActive: boolean
  metaTitle: string | null
  metaDescription: string | null
  variants: VariantDto[]
  images: ImageDto[]
  fragranceMeta: FragranceMetaDto | null
}

export type BundleItemDto = {
  variantId: number
  quantity: number
  productName: string
  productSlug: string
  sizeMl: number
  unitRetailPriceMinor: string | number
}

export type BundleDto = {
  id: number
  slug: string
  name: string
  description: string | null
  retailPriceMinor: string | number
  distributorPriceMinor: string | number
  currency: string
  isStarterPackage: boolean
  starterPackageCode: string | null
  isActive: boolean
  items: BundleItemDto[]
  images: ImageDto[]
  /** Sum of items.quantity * variant.retailPrice. Useful for "savings vs à-la-carte". */
  alaCarteTotalMinor: string | number
}
