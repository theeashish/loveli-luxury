'use client'

/**
 * Recently-viewed horizontal strip. Reads from the localStorage store
 * (client-only). Resolves slug -> product card via a thin server
 * round-trip; for Phase 4b-i we render link cards with name + image
 * placeholder, and let the user click through. (Hydrating full product
 * detail on every PDP would be wasteful for the strip's UX value.)
 *
 * Hidden until the store has hydrated to avoid an SSR/CSR mismatch.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRecentlyViewedStore } from '@/lib/recently-viewed/store'
import { recentlyViewedExcluding } from '@/lib/recently-viewed/logic'

interface Props {
  /** Exclude this productId from the strip (so the PDP doesn't show
   *  the current product). */
  excludeProductId?: number
}

export function RecentlyViewedStrip({ excludeProductId }: Props) {
  const items = useRecentlyViewedStore((s) => s.items)
  const hasHydrated = useRecentlyViewedStore((s) => s.hasHydrated)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted || !hasHydrated) return null

  const visible = recentlyViewedExcluding(items, excludeProductId ?? null)
  if (visible.length === 0) return null

  return (
    <section className="mt-16 border-t border-[hsl(var(--border))]/60 pt-10">
      <header className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
          You recently viewed
        </p>
      </header>
      <ul className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {visible.map((item) => (
          <li key={item.productId} className="shrink-0">
            <Link
              href={`/p/${item.slug}`}
              className="block rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/30 px-5 py-4 text-sm text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                {item.slug}
              </span>
              <span className="mt-1 block">
                Reopen ↗
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
