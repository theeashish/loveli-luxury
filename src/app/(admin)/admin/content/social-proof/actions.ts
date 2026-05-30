'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

// homepage_reviews / press_features aren't in the generated Database types
// yet (migration 026), so use an untyped service client for them.
function db(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient
}

function revalidateAll(productId?: number | null): void {
  revalidatePath('/admin/content/social-proof')
  revalidatePath('/')
  // When a review is tied to a PDP, also bust that PDP's cache so the new
  // review (or the loss of one) shows up immediately.
  if (typeof productId === 'number') {
    revalidatePath('/p/[slug]', 'page')
  }
}

// ── Reviews ───────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  quote: z.string().trim().min(3).max(600),
  authorName: z.string().trim().min(1).max(80),
  authorCity: z.string().trim().max(80).optional(),
  position: z.coerce.number().int().min(0).max(9999),
  // Empty / 0 means "Homepage carousel" (product_id NULL); positive means PDP.
  productId: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
})

export async function createReview(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const parsed = reviewSchema.safeParse({
    quote: formData.get('quote') ?? '',
    authorName: formData.get('authorName') ?? '',
    authorCity: (formData.get('authorCity') as string) || undefined,
    position: formData.get('position') || 0,
    productId: formData.get('productId') || 0,
  })
  if (!parsed.success) return
  const productId = parsed.data.productId && parsed.data.productId > 0 ? parsed.data.productId : null
  await db()
    .from('homepage_reviews')
    .insert({
      quote: parsed.data.quote,
      author_name: parsed.data.authorName,
      author_city: parsed.data.authorCity ?? null,
      position: parsed.data.position,
      product_id: productId,
      created_by: session.userId,
    })
  revalidateAll(productId)
}

export async function deleteReview(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  // Read the product_id first so we can revalidate the PDP if this was a
  // product-specific review.
  const before = await db()
    .from('homepage_reviews')
    .select('product_id')
    .eq('id', id)
    .maybeSingle()
  await db().from('homepage_reviews').delete().eq('id', id)
  const pid = (before.data as { product_id: number | null } | null)?.product_id ?? null
  revalidateAll(pid)
}

export async function toggleReviewPublished(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  const next = String(formData.get('next')) === 'true'
  const before = await db()
    .from('homepage_reviews')
    .select('product_id')
    .eq('id', id)
    .maybeSingle()
  await db().from('homepage_reviews').update({ is_published: next }).eq('id', id)
  const pid = (before.data as { product_id: number | null } | null)?.product_id ?? null
  revalidateAll(pid)
}

const reassignSchema = z.object({
  id: z.coerce.number().int().positive(),
  // Empty / 0 → detach from any product and put back on the homepage carousel.
  productId: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
})

export async function reassignReviewProduct(formData: FormData): Promise<void> {
  await requireAdmin()
  const parsed = reassignSchema.safeParse({
    id: formData.get('id'),
    productId: formData.get('productId') || 0,
  })
  if (!parsed.success) return
  const newProductId =
    parsed.data.productId && parsed.data.productId > 0 ? parsed.data.productId : null
  // Read the prior product_id so we can revalidate both the old and new PDP
  // pages if needed (a review moving between two PDPs needs both busted).
  const before = await db()
    .from('homepage_reviews')
    .select('product_id')
    .eq('id', parsed.data.id)
    .maybeSingle()
  await db()
    .from('homepage_reviews')
    .update({ product_id: newProductId })
    .eq('id', parsed.data.id)
  const priorPid = (before.data as { product_id: number | null } | null)?.product_id ?? null
  revalidateAll(priorPid ?? newProductId)
}

// ── Press / creator features ───────────────────────────────────────────────

const pressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500).optional().or(z.literal('')),
  position: z.coerce.number().int().min(0).max(9999),
})

export async function createPress(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const parsed = pressSchema.safeParse({
    name: formData.get('name') ?? '',
    url: (formData.get('url') as string) || '',
    position: formData.get('position') || 0,
  })
  if (!parsed.success) return
  const url = parsed.data.url && parsed.data.url.length > 0 ? parsed.data.url : null
  await db()
    .from('press_features')
    .insert({
      name: parsed.data.name,
      url,
      position: parsed.data.position,
      created_by: session.userId,
    })
  revalidateAll()
}

export async function deletePress(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  await db().from('press_features').delete().eq('id', id)
  revalidateAll()
}

export async function togglePressPublished(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id)) return
  const next = String(formData.get('next')) === 'true'
  await db().from('press_features').update({ is_published: next }).eq('id', id)
  revalidateAll()
}
