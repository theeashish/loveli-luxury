'use client'

import { useCartStore } from '@/lib/cart/store'
import { totalQty } from '@/lib/cart/selectors'

export function CartIndicator() {
  const lines = useCartStore((s) => s.lines)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const openDrawer = useCartStore((s) => s.openDrawer)

  // Render zero pre-hydration to avoid SSR/CSR markup divergence.
  const qty = hasHydrated ? totalQty({ lines }) : 0

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="relative inline-flex items-center gap-2 text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
      aria-label={`Cart with ${qty} item${qty === 1 ? '' : 's'}`}
    >
      <span>Cart</span>
      {qty > 0 ? (
        <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[hsl(var(--primary))] px-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))]">
          {qty}
        </span>
      ) : null}
    </button>
  )
}
