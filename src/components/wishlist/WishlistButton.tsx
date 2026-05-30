'use client'

/**
 * Heart-icon toggle. Lives on:
 *   - ProductCard (top-right corner, small)
 *   - PDP next to Add-to-cart (larger, labelled "Save")
 *   - BundleHighlight (top-right corner, small)
 *
 * The Zustand store handles persistence (localStorage for guests, also
 * mirrored to the DB for signed-in users). This component is pure UI.
 */

import { useEffect, useState } from 'react'
import { useWishlistStore } from '@/lib/wishlist/store'

interface CommonProps {
  /** "small" = corner icon on a card; "large" = labelled button next to CTA. */
  size?: 'small' | 'large'
  /** Additional className passed through. */
  className?: string
}

type ProductTarget = CommonProps & { productId: number; bundleId?: undefined }
type BundleTarget  = CommonProps & { bundleId: number;  productId?: undefined }

export function WishlistButton(props: ProductTarget | BundleTarget) {
  const { size = 'small', className = '' } = props
  const target = 'productId' in props && props.productId != null
    ? { productId: props.productId }
    : { bundleId: props.bundleId! }

  // SSR-safe: read membership from the store but coerce to false until
  // the persist middleware has hydrated, to avoid a hydration mismatch.
  const has = useWishlistStore((s) => s.has(target))
  const hasHydrated = useWishlistStore((s) => s.hasHydrated)
  const toggle = useWishlistStore((s) => s.toggle)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isSaved = mounted && hasHydrated && has

  const ariaLabel = isSaved ? 'Remove from wishlist' : 'Save to wishlist'

  if (size === 'large') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle(target)
        }}
        aria-label={ariaLabel}
        aria-pressed={isSaved}
        className={`group inline-flex items-center gap-2 rounded-md border px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition ${
          isSaved
            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
            : 'border-[hsl(var(--primary))]/40 text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]'
        } ${className}`}
      >
        <Heart filled={isSaved} className="h-4 w-4" />
        {isSaved ? 'Saved' : 'Save'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(target)
      }}
      aria-label={ariaLabel}
      aria-pressed={isSaved}
      className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
        isSaved
          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]/80 text-[hsl(var(--foreground))] backdrop-blur-sm hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]'
      } ${className}`}
    >
      <Heart filled={isSaved} className="h-4 w-4" />
    </button>
  )
}

function Heart({
  filled,
  className,
}: {
  filled: boolean
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.5 12.572 12 20l-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.566Z" />
    </svg>
  )
}
