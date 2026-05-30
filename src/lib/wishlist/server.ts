/**
 * Server-side wishlist helpers. Used by /api/wishlist and the
 * /account/wishlist page. All calls use the user-bound supabase client
 * — RLS on wishlist_items enforces self-only access.
 */

import 'server-only'
import type { WishlistItem } from './types'
import { createClient } from '@/lib/supabase/server'

/** List the signed-in user's wishlist, ordered most-recent first. */
export async function listMyWishlist(): Promise<WishlistItem[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // TODO(types): regenerate database.ts post-025; cast through unknown.
  const r = (await (supabase.from('wishlist_items' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: Array<{
            product_id: number | null
            bundle_id: number | null
            added_at: string
          }> | null
          error: { message: string } | null
        }>
      }
    }
  })
    .select('product_id, bundle_id, added_at')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false }))

  if (r.error) {
    throw new Error(`Wishlist read failed: ${r.error.message}`)
  }
  return (r.data ?? []).map((row) => ({
    productId: row.product_id,
    bundleId: row.bundle_id,
    addedAt: new Date(row.added_at).getTime(),
  }))
}

/** Add one item. Idempotent — the partial unique indexes make duplicate
 *  inserts a no-op that we catch and treat as success. */
export async function addToMyWishlist(target: {
  productId?: number
  bundleId?: number
}): Promise<{ ok: true } | { error: string }> {
  if (target.productId == null && target.bundleId == null) {
    return { error: 'Neither productId nor bundleId provided' }
  }
  if (target.productId != null && target.bundleId != null) {
    return { error: 'Only one of productId / bundleId may be provided' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in required' }

  const ins = (await (supabase.from('wishlist_items' as never) as unknown as {
    insert: (v: Record<string, unknown>) => Promise<{
      error: { message: string; code?: string } | null
    }>
  })
    .insert({
      user_id: user.id,
      product_id: target.productId ?? null,
      bundle_id: target.bundleId ?? null,
    }))

  if (ins.error) {
    // 23505 = unique violation — already saved. Idempotent success.
    if (ins.error.code === '23505') return { ok: true }
    return { error: ins.error.message }
  }
  return { ok: true }
}

/** Remove one item. No-op if not present. */
export async function removeFromMyWishlist(target: {
  productId?: number
  bundleId?: number
}): Promise<{ ok: true } | { error: string }> {
  if (target.productId == null && target.bundleId == null) {
    return { error: 'Neither productId nor bundleId provided' }
  }
  if (target.productId != null && target.bundleId != null) {
    return { error: 'Only one of productId / bundleId may be provided' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in required' }

  const builder = (supabase.from('wishlist_items' as never) as unknown as {
    delete: () => {
      eq: (col: string, val: unknown) => {
        is: (col: string, val: unknown) => Promise<{
          error: { message: string } | null
        }>
        eq?: (col: string, val: unknown) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  })
    .delete()
    .eq('user_id', user.id)

  let res
  if (target.productId != null) {
    res = await (builder as unknown as {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{
          error: { message: string } | null
        }>
      }
    })
      .eq('product_id', target.productId)
      .eq('user_id', user.id) // re-asserted (already set above; type-thread)
  } else {
    res = await (builder as unknown as {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{
          error: { message: string } | null
        }>
      }
    })
      .eq('bundle_id', target.bundleId!)
      .eq('user_id', user.id)
  }

  if (res.error) {
    return { error: res.error.message }
  }
  return { ok: true }
}
