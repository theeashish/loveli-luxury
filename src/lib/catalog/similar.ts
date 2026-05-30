/**
 * "Smells similar" — cross-sell helper for the PDP.
 *
 * Given a product's scent_family, returns up to 3 other ACTIVE products in
 * the same family, with their primary image + cheapest active variant
 * price. Excludes the current product. Returns an empty array when no
 * matches exist (or when scent_family is null).
 */

import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { joinImageUrl } from '@/lib/catalog/image-paths'
import { publicEnv } from '@/lib/env'

export type SimilarProduct = {
  id: number
  slug: string
  name: string
  imageUrl: string | null
  fromMinor: string | null
  scentFamily: string | null
}

const MAX_RESULTS = 3

export async function getSimilarProducts(
  productId: number,
  scentFamily: string | null,
): Promise<SimilarProduct[]> {
  if (!scentFamily) return []
  const service = createServiceClient()

  // 1. Find other products in the same scent_family (via product_fragrance_meta).
  const metaRes = (await (service.from('product_fragrance_meta' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        neq: (col: string, val: unknown) => {
          limit: (n: number) => Promise<{
            data: Array<{ product_id: number }> | null
            error: { message: string } | null
          }>
        }
      }
    }
  })
    .select('product_id')
    .eq('scent_family', scentFamily)
    .neq('product_id', productId)
    .limit(MAX_RESULTS * 3))

  if (metaRes.error || !metaRes.data) return []
  const candidateIds = metaRes.data.map((r) => r.product_id)
  if (candidateIds.length === 0) return []

  // 2. Pull the candidate products + their cheapest active variant + primary image.
  const productsRes = await service
    .from('products')
    .select('id, slug, name, is_active')
    .in('id', candidateIds)
    .eq('is_active', true)
    .limit(MAX_RESULTS)
  if (productsRes.error || !productsRes.data) return []
  const products = productsRes.data

  if (products.length === 0) return []
  const productIds = products.map((p) => p.id)

  const [variantsRes, imagesRes] = await Promise.all([
    service
      .from('product_variants')
      .select('product_id, retail_price_minor, is_active')
      .in('product_id', productIds)
      .eq('is_active', true),
    service
      .from('product_images')
      .select('product_id, storage_prefix, is_primary, position')
      .in('product_id', productIds)
      .order('position', { ascending: true }),
  ])

  const minMinorByProduct = new Map<number, bigint>()
  for (const v of variantsRes.data ?? []) {
    const cur = minMinorByProduct.get(v.product_id)
    const candidate = BigInt(v.retail_price_minor)
    if (cur === undefined || candidate < cur) {
      minMinorByProduct.set(v.product_id, candidate)
    }
  }

  const imageByProduct = new Map<number, string>()
  for (const img of imagesRes.data ?? []) {
    if (imageByProduct.has(img.product_id)) continue
    const url = joinImageUrl(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      img.storage_prefix,
      'thumb',
    )
    if (url) imageByProduct.set(img.product_id, url)
  }

  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    imageUrl: imageByProduct.get(p.id) ?? null,
    fromMinor: minMinorByProduct.get(p.id)?.toString() ?? null,
    scentFamily,
  }))
}
