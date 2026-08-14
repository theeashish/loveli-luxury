'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/cart/store'

function createCartId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return 'cart-' + Date.now() + '-' + Math.random().toString(16).slice(2)
}

export function CartHydrator() {
  useEffect(() => {
    const publishHydratedState = () => {
      const state = useCartStore.getState()
      if (!state.hasHydrated) {
        state.markHydrated(state.cartId || createCartId())
      }
    }

    const persist = useCartStore.persist
    const unsubscribe = persist.onFinishHydration(publishHydratedState)

    if (persist.hasHydrated()) {
      publishHydratedState()
    } else {
      void persist.rehydrate()
    }

    return unsubscribe
  }, [])

  return null
}
