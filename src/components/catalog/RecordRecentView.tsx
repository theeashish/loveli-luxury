'use client'

/**
 * Tiny client component mounted on the PDP. Calls record() once on mount.
 * Renders nothing. Separates the localStorage side-effect from the PDP
 * server component so the page can stay server-rendered.
 */

import { useEffect } from 'react'
import { useRecentlyViewedStore } from '@/lib/recently-viewed/store'

export function RecordRecentView({
  productId,
  slug,
}: {
  productId: number
  slug: string
}) {
  useEffect(() => {
    useRecentlyViewedStore.getState().record({ productId, slug })
  }, [productId, slug])
  return null
}
