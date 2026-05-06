import { describe, it, expect } from 'vitest'
import {
  aLaCarteTotalMinor,
  mapBundle,
  mapCategory,
  mapImage,
  mapProduct,
  mapProductSummary,
  mapVariant,
  minVariantPrice,
  pickPrimaryImage,
} from '../../src/lib/catalog/mappers'
import type { ImageDto, VariantDto } from '../../src/lib/catalog/types'

const rowImage = (over: Partial<Parameters<typeof mapImage>[0]> = {}) => ({
  id: 1,
  storage_prefix: 'products/1/abc',
  alt: null,
  position: 0,
  width: null,
  height: null,
  is_primary: false,
  ...over,
})

const rowVariant = (over: Partial<Parameters<typeof mapVariant>[0]> = {}) => ({
  id: 10,
  product_id: 1,
  sku: 'X',
  size_ml: 30,
  retail_price_minor: '400000',
  distributor_price_minor: '320000',
  weight_g: null,
  inventory_qty: 0,
  is_active: true,
  ...over,
})

describe('mapImage / mapVariant / mapCategory', () => {
  it('maps image rows to camelCase DTOs', () => {
    const dto = mapImage(rowImage({ alt: 'red', is_primary: true, position: 3 }))
    expect(dto).toEqual({
      id: 1,
      storagePrefix: 'products/1/abc',
      alt: 'red',
      position: 3,
      width: null,
      height: null,
      isPrimary: true,
    })
  })

  it('preserves bigint-safe price strings on variants', () => {
    const v = mapVariant(rowVariant())
    expect(v.retailPriceMinor).toBe('400000')
    expect(typeof v.retailPriceMinor).toBe('string')
  })

  it('maps category rows', () => {
    const c = mapCategory({
      id: 5,
      slug: 'frag',
      name: 'Fragrance',
      parent_id: null,
      position: 0,
      is_active: true,
    })
    expect(c.parentId).toBeNull()
  })
})

describe('pickPrimaryImage', () => {
  it('returns null on empty list', () => {
    expect(pickPrimaryImage([])).toBeNull()
  })

  it('prefers the explicit primary', () => {
    const a: ImageDto = mapImage(rowImage({ id: 1, position: 5 }))
    const b: ImageDto = mapImage(rowImage({ id: 2, position: 0, is_primary: true }))
    expect(pickPrimaryImage([a, b])?.id).toBe(2)
  })

  it('falls back to lowest-position when nothing is primary', () => {
    const a: ImageDto = mapImage(rowImage({ id: 1, position: 5 }))
    const b: ImageDto = mapImage(rowImage({ id: 2, position: 1 }))
    expect(pickPrimaryImage([a, b])?.id).toBe(2)
  })
})

describe('minVariantPrice', () => {
  it('returns null when no active variants', () => {
    expect(minVariantPrice([])).toBeNull()
    const v: VariantDto = mapVariant(rowVariant({ is_active: false }))
    expect(minVariantPrice([v])).toBeNull()
  })

  it('finds the minimum across active variants', () => {
    const v30 = mapVariant(rowVariant({ id: 1, retail_price_minor: '400000' }))
    const v50 = mapVariant(rowVariant({ id: 2, retail_price_minor: '720000' }))
    const v50Inactive = mapVariant(rowVariant({ id: 3, retail_price_minor: '1', is_active: false }))
    expect(minVariantPrice([v30, v50, v50Inactive])).toBe('400000')
  })

  it('handles bigints larger than Number.MAX_SAFE_INTEGER', () => {
    const big = mapVariant(rowVariant({ id: 1, retail_price_minor: '9007199254740993000' }))
    const small = mapVariant(rowVariant({ id: 2, retail_price_minor: '1' }))
    expect(minVariantPrice([big, small])).toBe('1')
  })
})

describe('aLaCarteTotalMinor', () => {
  it('multiplies and sums correctly with bigints', () => {
    const total = aLaCarteTotalMinor([
      { variantId: 1, quantity: 2, productName: 'A', productSlug: 'a', sizeMl: 30, unitRetailPriceMinor: '400000' },
      { variantId: 2, quantity: 1, productName: 'B', productSlug: 'b', sizeMl: 50, unitRetailPriceMinor: '720000' },
    ])
    expect(total).toBe('1520000')
  })

  it('returns "0" for an empty bundle', () => {
    expect(aLaCarteTotalMinor([])).toBe('0')
  })
})

describe('mapProduct / mapProductSummary', () => {
  const productRow = {
    id: 1,
    slug: 'rose-noir',
    name: 'Rose Noir',
    description: 'Floral',
    category_id: 2,
    is_active: true,
    meta_title: null,
    meta_description: null,
  }

  it('sorts variants by size ascending and images by position', () => {
    const v50 = rowVariant({ id: 1, size_ml: 50 })
    const v30 = rowVariant({ id: 2, size_ml: 30 })
    const i2 = rowImage({ id: 1, position: 2 })
    const i0 = rowImage({ id: 2, position: 0 })

    const dto = mapProduct(productRow, [v50, v30], [i2, i0])
    expect(dto.variants.map((v) => v.sizeMl)).toEqual([30, 50])
    expect(dto.images.map((i) => i.position)).toEqual([0, 2])
  })

  it('summary includes primary image and min retail price', () => {
    const v30 = rowVariant({ id: 1, size_ml: 30, retail_price_minor: '400000' })
    const v50 = rowVariant({ id: 2, size_ml: 50, retail_price_minor: '720000' })
    const primary = rowImage({ id: 1, position: 5, is_primary: true })
    const other = rowImage({ id: 2, position: 0 })

    const summary = mapProductSummary(productRow, [v30, v50], [primary, other])
    expect(summary.minRetailPriceMinor).toBe('400000')
    expect(summary.primaryImage?.id).toBe(1)
  })

  it('summary tolerates products with no images and no variants', () => {
    const summary = mapProductSummary(productRow, [], [])
    expect(summary.primaryImage).toBeNull()
    expect(summary.minRetailPriceMinor).toBeNull()
  })
})

describe('mapBundle', () => {
  const bundleRow = {
    id: 7,
    slug: 'starter-a',
    name: 'Starter Pack A',
    description: null,
    retail_price_minor: '1500000',
    distributor_price_minor: '1200000',
    currency: 'KES',
    is_starter_package: true,
    starter_package_code: 'A',
    is_active: true,
  }

  it('hydrates items, sorts images, and computes a-la-carte total', () => {
    const items = [
      {
        variant_id: 1,
        quantity: 2,
        product_name: 'Rose Noir',
        product_slug: 'rose-noir',
        size_ml: 30,
        unit_retail_price_minor: '400000',
      },
      {
        variant_id: 2,
        quantity: 1,
        product_name: 'Lavender',
        product_slug: 'lavender',
        size_ml: 50,
        unit_retail_price_minor: '720000',
      },
    ]
    const images = [rowImage({ id: 1, position: 2 }), rowImage({ id: 2, position: 0 })]

    const dto = mapBundle(bundleRow, items, images)
    expect(dto.items.length).toBe(2)
    expect(dto.alaCarteTotalMinor).toBe('1520000')
    expect(dto.images.map((i) => i.position)).toEqual([0, 2])
    expect(dto.starterPackageCode).toBe('A')
  })
})
