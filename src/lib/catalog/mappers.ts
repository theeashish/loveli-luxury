/**
 * Pure row → DTO mappers. No side effects, no DB calls.
 *
 * Supabase BIGINT columns arrive as strings via PostgREST. We pass them through
 * untouched at the wire layer; arithmetic is done in BigInt elsewhere.
 */

import type {
  ImageDto,
  VariantDto,
  CategoryDto,
  ProductSummaryDto,
  ProductDto,
  FragranceMetaDto,
  BundleItemDto,
  BundleDto,
} from './types'

type CategoryRow = {
  id: number
  slug: string
  name: string
  parent_id: number | null
  position: number
  is_active: boolean
}

type ProductRow = {
  id: number
  slug: string
  name: string
  description: string | null
  category_id: number | null
  is_active: boolean
  meta_title: string | null
  meta_description: string | null
}

type VariantRow = {
  id: number
  product_id: number
  sku: string
  size_ml: number
  retail_price_minor: string | number
  distributor_price_minor: string | number
  weight_g: number | null
  inventory_qty: number
  is_active: boolean
}

type ImageRow = {
  id: number
  storage_prefix: string
  alt: string | null
  position: number
  width: number | null
  height: number | null
  is_primary: boolean
}

type BundleRow = {
  id: number
  slug: string
  name: string
  description: string | null
  retail_price_minor: string | number
  distributor_price_minor: string | number
  currency: string
  is_starter_package: boolean
  starter_package_code: string | null
  is_active: boolean
}

type BundleItemRowHydrated = {
  variant_id: number
  quantity: number
  product_name: string
  product_slug: string
  size_ml: number
  unit_retail_price_minor: string | number
}

// -----------------------------------------------------------------------------

export function mapImage(row: ImageRow): ImageDto {
  return {
    id: row.id,
    storagePrefix: row.storage_prefix,
    alt: row.alt,
    position: row.position,
    width: row.width,
    height: row.height,
    isPrimary: row.is_primary,
  }
}

export function mapVariant(row: VariantRow): VariantDto {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    sizeMl: row.size_ml,
    retailPriceMinor: row.retail_price_minor,
    distributorPriceMinor: row.distributor_price_minor,
    weightG: row.weight_g,
    inventoryQty: row.inventory_qty,
    isActive: row.is_active,
  }
}

export function mapCategory(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parent_id,
    position: row.position,
    isActive: row.is_active,
  }
}

export function pickPrimaryImage(images: readonly ImageDto[]): ImageDto | null {
  if (images.length === 0) return null
  const primary = images.find((i) => i.isPrimary)
  if (primary) return primary
  // Fall back to lowest-position image so storefront has something to render.
  const sorted = [...images].sort((a, b) => a.position - b.position)
  return sorted[0] ?? null
}

export function minVariantPrice(variants: readonly VariantDto[]): string | null {
  const active = variants.filter((v) => v.isActive)
  if (active.length === 0) return null
  let min: bigint | null = null
  for (const v of active) {
    const p = BigInt(v.retailPriceMinor)
    if (min === null || p < min) min = p
  }
  return min === null ? null : min.toString()
}

export function mapProductSummary(
  product: ProductRow,
  variants: readonly VariantRow[],
  images: readonly ImageRow[],
): ProductSummaryDto {
  const variantDtos = variants.map(mapVariant)
  const imageDtos = images.map(mapImage)
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.category_id,
    isActive: product.is_active,
    primaryImage: pickPrimaryImage(imageDtos),
    minRetailPriceMinor: minVariantPrice(variantDtos),
  }
}

export type FragranceMetaRow = {
  product_id: number
  top_notes: string[] | null
  heart_notes: string[] | null
  base_notes: string[] | null
  longevity: string | null
  projection: string | null
  climate_note: string | null
  occasions: string[] | null
  story: string | null
  scent_family: string | null
  inspired_by: string | null
}

export function mapFragranceMeta(
  row: FragranceMetaRow | null | undefined,
): FragranceMetaDto | null {
  if (!row) return null
  return {
    topNotes: row.top_notes ?? [],
    heartNotes: row.heart_notes ?? [],
    baseNotes: row.base_notes ?? [],
    longevity: row.longevity,
    projection: row.projection,
    climateNote: row.climate_note,
    occasions: row.occasions ?? [],
    story: row.story,
    scentFamily: row.scent_family,
    inspiredBy: row.inspired_by,
  }
}

export function mapProduct(
  product: ProductRow,
  variants: readonly VariantRow[],
  images: readonly ImageRow[],
  fragranceMeta?: FragranceMetaRow | null,
): ProductDto {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    categoryId: product.category_id,
    isActive: product.is_active,
    metaTitle: product.meta_title,
    metaDescription: product.meta_description,
    variants: [...variants].sort((a, b) => a.size_ml - b.size_ml).map(mapVariant),
    images: [...images].sort((a, b) => a.position - b.position).map(mapImage),
    fragranceMeta: mapFragranceMeta(fragranceMeta),
  }
}

export function aLaCarteTotalMinor(items: readonly BundleItemDto[]): string {
  let total = 0n
  for (const it of items) {
    total += BigInt(it.unitRetailPriceMinor) * BigInt(it.quantity)
  }
  return total.toString()
}

export function mapBundle(
  bundle: BundleRow,
  items: readonly BundleItemRowHydrated[],
  images: readonly ImageRow[],
): BundleDto {
  const itemDtos: BundleItemDto[] = items.map((it) => ({
    variantId: it.variant_id,
    quantity: it.quantity,
    productName: it.product_name,
    productSlug: it.product_slug,
    sizeMl: it.size_ml,
    unitRetailPriceMinor: it.unit_retail_price_minor,
  }))
  return {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    retailPriceMinor: bundle.retail_price_minor,
    distributorPriceMinor: bundle.distributor_price_minor,
    currency: bundle.currency,
    isStarterPackage: bundle.is_starter_package,
    starterPackageCode: bundle.starter_package_code,
    isActive: bundle.is_active,
    items: itemDtos,
    images: [...images].sort((a, b) => a.position - b.position).map(mapImage),
    alaCarteTotalMinor: aLaCarteTotalMinor(itemDtos),
  }
}
