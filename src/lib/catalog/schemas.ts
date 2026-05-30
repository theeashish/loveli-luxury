/**
 * Zod input schemas for catalog admin operations.
 *
 * Money is accepted as decimal-string minor units (e.g. "400000" for KES 4,000).
 * That keeps the wire format identical to what comes back from PostgREST and
 * avoids float coercion through the form layer.
 */

import { z } from 'zod'
import { isValidSlug } from './slug'

const slug = z
  .string()
  .min(1)
  .max(80)
  .refine(isValidSlug, { message: 'invalid slug — lowercase a-z, 0-9, hyphens, no leading/trailing hyphen' })

const minorAmount = z
  .string()
  .regex(/^\d+$/, 'must be a non-negative integer in minor units')
  .refine((s) => s.length <= 18, { message: 'amount too large' })

const sku = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'sku may contain alphanumerics, dot, underscore, hyphen')

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

export const createCategorySchema = z.object({
  slug,
  name: z.string().min(1).max(120),
  parentId: z.number().int().positive().nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

export const updateCategorySchema = createCategorySchema.partial().extend({
  id: z.number().int().positive(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

export const createProductSchema = z.object({
  slug,
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
})

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.number().int().positive(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

const variantBase = z.object({
  productId: z.number().int().positive(),
  sku,
  sizeMl: z.number().int().positive().max(10_000),
  retailPriceMinor: minorAmount,
  distributorPriceMinor: minorAmount,
  weightG: z.number().int().positive().nullable().optional(),
  inventoryQty: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
})

const distributorPriceNotAboveRetail = (
  v: { retailPriceMinor: string | number; distributorPriceMinor: string },
) => BigInt(v.distributorPriceMinor) <= BigInt(v.retailPriceMinor)

export const createVariantSchema = variantBase.refine(distributorPriceNotAboveRetail, {
  message: 'distributor price cannot exceed retail price',
  path: ['distributorPriceMinor'],
})

export const updateVariantSchema = variantBase
  .partial()
  .extend({ id: z.number().int().positive() })
  .superRefine((v, ctx) => {
    if (v.retailPriceMinor !== undefined && v.distributorPriceMinor !== undefined) {
      if (BigInt(v.distributorPriceMinor) > BigInt(v.retailPriceMinor)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'distributor price cannot exceed retail price',
          path: ['distributorPriceMinor'],
        })
      }
    }
  })

export type CreateVariantInput = z.infer<typeof createVariantSchema>
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>

// -----------------------------------------------------------------------------
// Bundles
// -----------------------------------------------------------------------------

const bundleItem = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().positive().max(100),
})

export const createBundleSchema = z
  .object({
    slug,
    name: z.string().min(1).max(200),
    description: z.string().max(5000).nullable().optional(),
    retailPriceMinor: minorAmount,
    distributorPriceMinor: minorAmount,
    currency: z.string().length(3).toUpperCase().default('KES'),
    isStarterPackage: z.boolean().default(false),
    starterPackageCode: z
      .string()
      .regex(/^[A-Z]$/, 'single uppercase letter, e.g. A or B')
      .nullable()
      .optional(),
    isActive: z.boolean().default(true),
    items: z.array(bundleItem).min(1).max(50),
  })
  .refine(distributorPriceNotAboveRetail, {
    message: 'distributor price cannot exceed retail price',
    path: ['distributorPriceMinor'],
  })
  .refine((v) => !v.isStarterPackage || !!v.starterPackageCode, {
    message: 'starter package code is required when isStarterPackage is true',
    path: ['starterPackageCode'],
  })
  .refine(
    (v) => {
      const ids = v.items.map((i) => i.variantId)
      return new Set(ids).size === ids.length
    },
    { message: 'bundle cannot list the same variant twice', path: ['items'] },
  )

export const updateBundleSchema = z.object({
  id: z.number().int().positive(),
  slug: slug.optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  retailPriceMinor: minorAmount.optional(),
  distributorPriceMinor: minorAmount.optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  isStarterPackage: z.boolean().optional(),
  starterPackageCode: z.string().regex(/^[A-Z]$/).nullable().optional(),
  isActive: z.boolean().optional(),
  items: z.array(bundleItem).min(1).max(50).optional(),
})

export type CreateBundleInput = z.infer<typeof createBundleSchema>
export type UpdateBundleInput = z.infer<typeof updateBundleSchema>

// -----------------------------------------------------------------------------
// Images (metadata only — file upload handled by the image pipeline)
// -----------------------------------------------------------------------------

export const updateImageSchema = z.object({
  id: z.number().int().positive(),
  alt: z.string().max(300).nullable().optional(),
  position: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
})

export type UpdateImageInput = z.infer<typeof updateImageSchema>
