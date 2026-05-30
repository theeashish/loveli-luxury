/**
 * Catalog read queries. Server-only — these import the cookie-bound supabase
 * client and rely on RLS to scope visibility.
 *
 * For storefront calls: pass `includeInactive: false` (the default). RLS will
 * also filter inactive rows for anon users; the explicit flag is belt and
 * braces.
 *
 * For admin pages: use the service-role client directly (server-only) so we
 * can read inactive rows and orphaned variants. The caller is responsible for
 * verifying admin role first — see requireAdmin() in mutations.ts.
 */

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase/server'
import { createServiceClient } from '../supabase/service'
import {
  mapBundle,
  mapCategory,
  mapProduct,
  mapProductSummary,
} from './mappers'
import type { FragranceMetaRow } from './mappers'
import type {
  BundleDto,
  CategoryDto,
  ProductDto,
  ProductSummaryDto,
} from './types'
import type { Database } from '../../types/database'

type ReadOpts = { includeInactive?: boolean }

type Client = SupabaseClient<Database>

function readClient(opts: ReadOpts): Client {
  return opts.includeInactive
    ? (createServiceClient() as Client)
    : (createClient() as unknown as Client)
}

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

export async function listCategories(opts: ReadOpts = {}): Promise<CategoryDto[]> {
  const supabase = readClient(opts)
  let query = supabase
    .from('categories')
    .select()
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (!opts.includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapCategory)
}

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

export async function listProductSummaries(opts: ReadOpts = {}): Promise<ProductSummaryDto[]> {
  const supabase = readClient(opts)
  let q = supabase.from('products').select().order('id', { ascending: false })
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data: products, error } = await q
  if (error) throw error
  if (!products || products.length === 0) return []

  const ids = products.map((p) => p.id)
  const [variantsRes, imagesRes] = await Promise.all([
    supabase.from('product_variants').select().in('product_id', ids),
    supabase.from('product_images').select().in('product_id', ids),
  ])
  if (variantsRes.error) throw variantsRes.error
  if (imagesRes.error) throw imagesRes.error
  const variants = variantsRes.data ?? []
  const images = imagesRes.data ?? []

  const byProduct = new Map<number, { v: typeof variants; i: typeof images }>()
  for (const p of products) byProduct.set(p.id, { v: [], i: [] })
  for (const v of variants) byProduct.get(v.product_id)?.v.push(v)
  for (const img of images) byProduct.get(img.product_id)?.i.push(img)

  return products.map((p) => {
    const bucket = byProduct.get(p.id)
    return mapProductSummary(p, bucket?.v ?? [], bucket?.i ?? [])
  })
}

export async function getProductBySlug(
  slug: string,
  opts: ReadOpts = {},
): Promise<ProductDto | null> {
  const supabase = readClient(opts)
  let q = supabase.from('products').select().eq('slug', slug).limit(1)
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  if (!data) return null

  const [variantsRes, imagesRes, metaRes] = await Promise.all([
    supabase
      .from('product_variants')
      .select()
      .eq('product_id', data.id)
      .order('size_ml', { ascending: true }),
    supabase
      .from('product_images')
      .select()
      .eq('product_id', data.id)
      .order('position', { ascending: true }),
    // product_fragrance_meta is not in the generated Database types yet (regen
    // pending, punch-list P3), so read it via an untyped client. A missing row
    // OR a not-yet-applied table both degrade to no detail block.
    (supabase as unknown as SupabaseClient)
      .from('product_fragrance_meta')
      .select()
      .eq('product_id', data.id)
      .maybeSingle(),
  ])
  if (variantsRes.error) throw variantsRes.error
  if (imagesRes.error) throw imagesRes.error

  const fragranceMeta = (metaRes.error ? null : metaRes.data) as FragranceMetaRow | null
  return mapProduct(data, variantsRes.data ?? [], imagesRes.data ?? [], fragranceMeta)
}

export async function getProductById(
  id: number,
  opts: ReadOpts = {},
): Promise<ProductDto | null> {
  const supabase = readClient(opts)
  let q = supabase.from('products').select().eq('id', id).limit(1)
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  if (!data) return null

  const [variantsRes, imagesRes, metaRes] = await Promise.all([
    supabase
      .from('product_variants')
      .select()
      .eq('product_id', data.id)
      .order('size_ml', { ascending: true }),
    supabase
      .from('product_images')
      .select()
      .eq('product_id', data.id)
      .order('position', { ascending: true }),
    // product_fragrance_meta is not in the generated Database types yet (regen
    // pending, punch-list P3), so read it via an untyped client. A missing row
    // OR a not-yet-applied table both degrade to no detail block.
    (supabase as unknown as SupabaseClient)
      .from('product_fragrance_meta')
      .select()
      .eq('product_id', data.id)
      .maybeSingle(),
  ])
  if (variantsRes.error) throw variantsRes.error
  if (imagesRes.error) throw imagesRes.error

  const fragranceMeta = (metaRes.error ? null : metaRes.data) as FragranceMetaRow | null
  return mapProduct(data, variantsRes.data ?? [], imagesRes.data ?? [], fragranceMeta)
}

export async function listActiveProductSlugs(): Promise<string[]> {
  // Service client: this is called from `generateStaticParams`, which runs
  // outside any request scope at build time, so the cookie-bound client would
  // throw. The selection is restricted to active rows — no sensitive data.
  const supabase = createServiceClient() as Client
  const { data, error } = await supabase.from('products').select().eq('is_active', true)
  if (error) throw error
  return (data ?? []).map((r) => r.slug)
}

// -----------------------------------------------------------------------------
// Bundles
// -----------------------------------------------------------------------------

export async function listBundles(opts: ReadOpts = {}): Promise<BundleDto[]> {
  const supabase = readClient(opts)
  let q = supabase.from('bundles').select().order('id', { ascending: false })
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data: bundles, error } = await q
  if (error) throw error
  if (!bundles || bundles.length === 0) return []

  return Promise.all(bundles.map((b) => hydrateBundle(supabase, b)))
}

export async function getBundleBySlug(
  slug: string,
  opts: ReadOpts = {},
): Promise<BundleDto | null> {
  const supabase = readClient(opts)
  let q = supabase.from('bundles').select().eq('slug', slug).limit(1)
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  if (!data) return null
  return hydrateBundle(supabase, data)
}

export async function getBundleById(
  id: number,
  opts: ReadOpts = {},
): Promise<BundleDto | null> {
  const supabase = readClient(opts)
  let q = supabase.from('bundles').select().eq('id', id).limit(1)
  if (!opts.includeInactive) q = q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  if (!data) return null
  return hydrateBundle(supabase, data)
}

export async function listActiveBundleSlugs(): Promise<string[]> {
  // Service client: see `listActiveProductSlugs`. Build-time static param
  // generation runs outside a request scope.
  const supabase = createServiceClient() as Client
  const { data, error } = await supabase.from('bundles').select().eq('is_active', true)
  if (error) throw error
  return (data ?? []).map((r) => r.slug)
}

async function hydrateBundle(
  supabase: Client,
  bundle: Database['public']['Tables']['bundles']['Row'],
): Promise<BundleDto> {
  const [itemsRes, imagesRes] = await Promise.all([
    supabase.from('bundle_items').select().eq('bundle_id', bundle.id),
    supabase
      .from('bundle_images')
      .select()
      .eq('bundle_id', bundle.id)
      .order('position', { ascending: true }),
  ])
  if (itemsRes.error) throw itemsRes.error
  if (imagesRes.error) throw imagesRes.error
  const items = itemsRes.data ?? []
  const images = imagesRes.data ?? []

  if (items.length === 0) {
    return mapBundle(bundle, [], images)
  }

  const variantIds = items.map((it) => it.variant_id)
  const { data: variants, error: vErr } = await supabase
    .from('product_variants')
    .select()
    .in('id', variantIds)
  if (vErr) throw vErr

  const productIds = Array.from(new Set((variants ?? []).map((v) => v.product_id)))
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select()
    .in('id', productIds)
  if (pErr) throw pErr

  const variantById = new Map((variants ?? []).map((v) => [v.id, v] as const))
  const productById = new Map((products ?? []).map((p) => [p.id, p] as const))

  const hydrated = items.map((it) => {
    const v = variantById.get(it.variant_id)
    if (!v) throw new Error(`bundle_items references missing variant ${it.variant_id}`)
    const p = productById.get(v.product_id)
    if (!p) throw new Error(`product ${v.product_id} missing for variant ${v.id}`)
    return {
      variant_id: v.id,
      quantity: it.quantity,
      product_name: p.name,
      product_slug: p.slug,
      size_ml: v.size_ml,
      unit_retail_price_minor: v.retail_price_minor,
    }
  })

  return mapBundle(bundle, hydrated, images)
}
