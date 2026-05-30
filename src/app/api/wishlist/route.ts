/**
 * /api/wishlist — wishlist CRUD for the signed-in user.
 *
 * GET     → list the user's wishlist as { items: WishlistItem[] }
 * POST    → add { productId?: number, bundleId?: number }
 * DELETE  → remove { productId?: number, bundleId?: number }
 *
 * All routes require an authenticated user (401 otherwise — the client
 * store falls back to local-only mode on 401, so this is non-fatal UX).
 * RLS on wishlist_items is the second line of defense (a forged user_id
 * would still get rejected at the DB layer).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  addToMyWishlist,
  listMyWishlist,
  removeFromMyWishlist,
} from '@/lib/wishlist/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const targetSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    bundleId:  z.number().int().positive().optional(),
  })
  .refine((d) => (d.productId == null) !== (d.bundleId == null), {
    message: 'Provide exactly one of productId or bundleId',
  })

export async function GET() {
  try {
    const items = await listMyWishlist()
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = targetSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const res = await addToMyWishlist(parsed.data)
  if ('error' in res) {
    return NextResponse.json(
      { error: res.error },
      { status: res.error === 'Sign in required' ? 401 : 500 },
    )
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = targetSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const res = await removeFromMyWishlist(parsed.data)
  if ('error' in res) {
    return NextResponse.json(
      { error: res.error },
      { status: res.error === 'Sign in required' ? 401 : 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
