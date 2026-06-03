'use client'

import { useState } from 'react'
import { toast } from '@/lib/toast'
import { useCartStore } from '@/lib/cart/store'
import type { CartLineInput } from '@/lib/cart/types'

export function AddToCartButton({
  line,
  disabled = false,
  className,
}: {
  line: CartLineInput
  disabled?: boolean
  className?: string
}) {
  const add = useCartStore((s) => s.add)
  const openDrawer = useCartStore((s) => s.openDrawer)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const [isAdding, setIsAdding] = useState(false)

  const onClick = () => {
    setIsAdding(true)
    try {
      add(line, 1)
      openDrawer()
      toast.success('Added to cart', { description: line.name })
    } finally {
      setTimeout(() => setIsAdding(false), 250)
    }
  }

  const isDisabled = disabled || !hasHydrated || isAdding

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={
        className ??
        'inline-flex w-full items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
      }
    >
      {isAdding ? 'Added' : disabled ? 'Sold out' : 'Add to cart'}
    </button>
  )
}
