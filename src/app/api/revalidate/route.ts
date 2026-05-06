/**
 * On-demand ISR trigger.
 *
 * Surface: `POST /api/revalidate`
 * Auth:    `Authorization: Bearer <REVALIDATE_SECRET>` (timing-safe compare)
 * Body:    `{ "paths": ["/shop", "/p/some-slug", ...] }`
 *
 * Why a route at all when mutations already call `revalidatePath()`?
 *   - Lets external systems (deploy hooks, scheduled jobs, ops scripts) flush
 *     specific catalog routes without going through the admin UI.
 *   - Decouples cache invalidation from any single mutation path.
 *
 * Path validation is a strict allow-list (`validateRevalidatePath`) covering
 * the catalog surfaces declared static in step 6. A leaked token cannot be
 * used to thrash unrelated routes.
 */

import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { validateRevalidatePath } from '@/lib/catalog/revalidate-paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  paths: z.array(z.string()).min(1).max(64),
})

export async function POST(request: NextRequest) {
  // Read the secret lazily so the route module loads cleanly during build-time
  // page-data collection without a populated .env. Validation matches
  // `serverSchema` in lib/env.ts (min 32 chars).
  const expected = process.env.REVALIDATE_SECRET
  if (!expected || expected.length < 32) {
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 })
  }

  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const presented = auth.slice('Bearer '.length).trim()

  if (!constantTimeEqual(presented, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const accepted: string[] = []
  const rejected: Array<{ path: unknown; reason: string }> = []
  for (const candidate of parsed.data.paths) {
    const verdict = validateRevalidatePath(candidate)
    if (verdict.ok) {
      accepted.push(verdict.path)
    } else {
      rejected.push({ path: candidate, reason: verdict.reason })
    }
  }

  if (rejected.length > 0) {
    return NextResponse.json(
      { error: 'rejected paths', rejected },
      { status: 400 },
    )
  }

  for (const p of accepted) revalidatePath(p)

  return NextResponse.json({
    revalidated: true,
    paths: accepted,
    now: Date.now(),
  })
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
