'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/cart/store'

/**
 * Tiny client island rendered on the confirmation page only when the order
 * is paid. Empties the persisted cart so the next visit starts clean.
 *
 * We wait for the persist middleware to hydrate first; clearing before
 * hydration would race the rehydration and re-populate the cart from
 * localStorage.
 */
export function ClearCartOnSuccess() {
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const clear = useCartStore((s) => s.clear)

  useEffect(() => {
    if (hasHydrated) clear()
  }, [hasHydrated, clear])

  return null
}
