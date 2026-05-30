'use client'

/**
 * Hydrator — mounted once at the root of (public)/layout.tsx. Reads
 * the Supabase auth session via the browser client, sets the wishlist
 * store's mode accordingly, and (when signed in) pulls + merges the
 * server-side wishlist.
 *
 * Renders nothing.
 */

import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  pullAndMergeFromServer,
  useWishlistStore,
} from '@/lib/wishlist/store'

export function WishlistHydrator() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    let cancelled = false

    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) {
        useWishlistStore.getState().setMode('signed_in')
        await pullAndMergeFromServer()
      } else {
        useWishlistStore.getState().setMode('guest')
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      if (session?.user) {
        useWishlistStore.getState().setMode('signed_in')
        await pullAndMergeFromServer()
      } else {
        useWishlistStore.getState().setMode('guest')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return null
}
