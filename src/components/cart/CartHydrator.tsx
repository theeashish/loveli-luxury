'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/cart/store'

export function CartHydrator() {
  useEffect(() => {
    const persist = useCartStore.persist
    const unsubscribe = persist.onFinishHydration(() => {
      const state = useCartStore.getState()
      if (!state.hasHydrated) {
        state.markHydrated(state.cartId || createCartId())
      }
    })

    void persist.rehydrate()
    return unsubscribe
  }, [])

  return null
}

function createCartId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return 'cart-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}
