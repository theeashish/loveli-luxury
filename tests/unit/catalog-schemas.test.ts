import { describe, it, expect } from 'vitest'
import {
  createBundleSchema,
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  updateBundleSchema,
  updateImageSchema,
  updateProductSchema,
  updateVariantSchema,
} from '../../src/lib/catalog/schemas'

describe('createCategorySchema', () => {
  it('accepts a minimal category', () => {
    const r = createCategorySchema.parse({ slug: 'fragrance', name: 'Fragrance' })
    expect(r.position).toBe(0)
    expect(r.isActive).toBe(true)
    expect(r.parentId).toBeUndefined()
  })

  it('rejects bad slug', () => {
    expect(() => createCategorySchema.parse({ slug: 'Bad Slug', name: 'X' })).toThrow()
  })
})

describe('createProductSchema', () => {
  it('accepts a minimal product', () => {
    const r = createProductSchema.parse({ slug: 'rose-noir', name: 'Rose Noir' })
    expect(r.isActive).toBe(true)
  })

  it('rejects empty name', () => {
    expect(() => createProductSchema.parse({ slug: 'rose', name: '' })).toThrow()
  })

  it('rejects bad meta_description length', () => {
    expect(() =>
      createProductSchema.parse({
        slug: 'rose',
        name: 'Rose',
        metaDescription: 'x'.repeat(501),
      }),
    ).toThrow()
  })
})

describe('updateProductSchema', () => {
  it('requires id even when no other fields', () => {
    const r = updateProductSchema.parse({ id: 7 })
    expect(r.id).toBe(7)
  })

  it('rejects missing id', () => {
    expect(() => updateProductSchema.parse({ name: 'New' })).toThrow()
  })
})

describe('createVariantSchema', () => {
  it('accepts a sane variant', () => {
    const r = createVariantSchema.parse({
      productId: 1,
      sku: 'RN-30',
      sizeMl: 30,
      retailPriceMinor: '400000',
      distributorPriceMinor: '320000',
    })
    expect(r.inventoryQty).toBe(0)
  })

  it('rejects distributor price above retail', () => {
    expect(() =>
      createVariantSchema.parse({
        productId: 1,
        sku: 'RN-30',
        sizeMl: 30,
        retailPriceMinor: '400000',
        distributorPriceMinor: '500000',
      }),
    ).toThrow(/distributor price cannot exceed/)
  })

  it('rejects float-ish price strings', () => {
    expect(() =>
      createVariantSchema.parse({
        productId: 1,
        sku: 'RN-30',
        sizeMl: 30,
        retailPriceMinor: '400000.50',
        distributorPriceMinor: '320000',
      }),
    ).toThrow()
  })

  it('rejects malformed SKU', () => {
    expect(() =>
      createVariantSchema.parse({
        productId: 1,
        sku: ' bad sku',
        sizeMl: 30,
        retailPriceMinor: '1',
        distributorPriceMinor: '1',
      }),
    ).toThrow()
  })
})

describe('updateVariantSchema', () => {
  it('only enforces price ordering when both fields present', () => {
    expect(() =>
      updateVariantSchema.parse({ id: 1, retailPriceMinor: '100', distributorPriceMinor: '200' }),
    ).toThrow(/distributor price/)
  })

  it('skips price ordering when only one side is provided', () => {
    expect(() => updateVariantSchema.parse({ id: 1, retailPriceMinor: '100' })).not.toThrow()
    expect(() => updateVariantSchema.parse({ id: 1, distributorPriceMinor: '99999' })).not.toThrow()
  })
})

describe('createBundleSchema', () => {
  const baseBundle = {
    slug: 'starter-a',
    name: 'Starter Pack A',
    retailPriceMinor: '400000',
    distributorPriceMinor: '320000',
    items: [{ variantId: 1, quantity: 1 }],
  }

  it('accepts a normal retail bundle', () => {
    const r = createBundleSchema.parse(baseBundle)
    expect(r.currency).toBe('KES')
    expect(r.isStarterPackage).toBe(false)
  })

  it('requires starter package code when isStarterPackage', () => {
    expect(() =>
      createBundleSchema.parse({ ...baseBundle, isStarterPackage: true }),
    ).toThrow(/starter package code/)
  })

  it('accepts a starter package with code', () => {
    const r = createBundleSchema.parse({
      ...baseBundle,
      isStarterPackage: true,
      starterPackageCode: 'A',
    })
    expect(r.starterPackageCode).toBe('A')
  })

  it('rejects duplicate variants', () => {
    expect(() =>
      createBundleSchema.parse({
        ...baseBundle,
        items: [
          { variantId: 1, quantity: 1 },
          { variantId: 1, quantity: 2 },
        ],
      }),
    ).toThrow(/same variant twice/)
  })

  it('rejects empty items list', () => {
    expect(() => createBundleSchema.parse({ ...baseBundle, items: [] })).toThrow()
  })

  it('uppercases currency', () => {
    const r = createBundleSchema.parse({ ...baseBundle, currency: 'usd' })
    expect(r.currency).toBe('USD')
  })
})

describe('updateBundleSchema', () => {
  it('requires id', () => {
    expect(() => updateBundleSchema.parse({ name: 'X' })).toThrow()
  })

  it('accepts a partial update', () => {
    const r = updateBundleSchema.parse({ id: 9, name: 'Renamed' })
    expect(r.id).toBe(9)
  })
})

describe('updateImageSchema', () => {
  it('accepts a primary flip', () => {
    const r = updateImageSchema.parse({ id: 1, isPrimary: true })
    expect(r.isPrimary).toBe(true)
  })

  it('rejects a too-long alt', () => {
    expect(() => updateImageSchema.parse({ id: 1, alt: 'x'.repeat(301) })).toThrow()
  })
})
