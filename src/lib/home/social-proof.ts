import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Read layer for the homepage social-proof CMS (migration 026).
 *
 * `homepage_reviews` / `press_features` are not yet in the generated
 * `Database` types, so we use an untyped service client for them and shape
 * the rows by hand. The service client carries no cookies, so the homepage
 * stays statically renderable (no forced dynamic).
 *
 * Each reader returns `null` when the source is unreachable — e.g. before
 * migration 026 is applied — so the caller can fall back to built-in
 * placeholder content. An empty array means "no published rows" → the
 * caller should hide the section.
 */

export type HomeReview = {
  id: number
  quote: string
  authorName: string
  authorCity: string | null
}

export type PressFeature = {
  id: number
  name: string
  url: string | null
}

function db(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient
}

/**
 * Homepage social-proof reviews — only rows with `product_id IS NULL` so
 * product-specific reviews (migration 038) don't leak into the brand-wide
 * carousel.
 */
export async function getPublishedReviews(): Promise<HomeReview[] | null> {
  try {
    const res = await db()
      .from('homepage_reviews')
      .select('id, quote, author_name, author_city')
      .eq('is_published', true)
      .is('product_id', null)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (res.error) return null
    const rows = (res.data ?? []) as Array<{
      id: number
      quote: string
      author_name: string
      author_city: string | null
    }>
    return rows.map((r) => ({
      id: r.id,
      quote: r.quote,
      authorName: r.author_name,
      authorCity: r.author_city,
    }))
  } catch {
    return null
  }
}

/**
 * PDP-specific reviews — rows where `product_id` matches the given id.
 * Mirrors getPublishedReviews shape; returns null on source error and an
 * empty array when there are no published rows for the product.
 */
export async function getProductReviews(
  productId: number,
): Promise<HomeReview[] | null> {
  try {
    const res = await db()
      .from('homepage_reviews')
      .select('id, quote, author_name, author_city')
      .eq('is_published', true)
      .eq('product_id', productId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (res.error) return null
    const rows = (res.data ?? []) as Array<{
      id: number
      quote: string
      author_name: string
      author_city: string | null
    }>
    return rows.map((r) => ({
      id: r.id,
      quote: r.quote,
      authorName: r.author_name,
      authorCity: r.author_city,
    }))
  } catch {
    return null
  }
}

export async function getPublishedPress(): Promise<PressFeature[] | null> {
  try {
    const res = await db()
      .from('press_features')
      .select('id, name, url')
      .eq('is_published', true)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (res.error) return null
    const rows = (res.data ?? []) as Array<{
      id: number
      name: string
      url: string | null
    }>
    return rows.map((p) => ({ id: p.id, name: p.name, url: p.url }))
  } catch {
    return null
  }
}
