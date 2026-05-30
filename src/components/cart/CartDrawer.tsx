'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { useCartStore } from '@/lib/cart/store'
import { subtotalMinor, totalBundleSavingsMinor, totalQty } from '@/lib/cart/selectors'
import { CartLineItem } from './CartLineItem'

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isDrawerOpen)
  const close = useCartStore((s) => s.closeDrawer)
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const lines = useCartStore((s) => s.lines)

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [isOpen])

  if (!hasHydrated) return null

  const visibleLines = lines
  const subtotal = subtotalMinor({ lines: visibleLines })
  const savings = totalBundleSavingsMinor({ lines: visibleLines })
  const qty = totalQty({ lines: visibleLines })

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? 'visible' : 'invisible delay-200'}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close cart"
        onClick={close}
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-2xl transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-5">
          <div>
            <h2 className="text-lg font-medium">Your cart</h2>
            <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
              {qty} item{qty === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            className="text-2xl leading-none text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))]"
          >
            ×
          </button>
        </header>

        {visibleLines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Your cart is empty.</p>
            <Link
              href="/shop"
              onClick={close}
              className="mt-6 rounded-md border border-[hsl(var(--border))] px-5 py-2 text-xs uppercase tracking-[0.15em] text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))]"
            >
              Browse the collection
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-6">
              {visibleLines.map((line) => (
                <CartLineItem key={line.kind === 'variant' ? `v${line.variantId}` : `b${line.bundleId}`} line={line} />
              ))}
            </ul>

            <footer className="space-y-3 border-t border-[hsl(var(--border))] px-6 py-5">
              {savings > 0n ? (
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-[hsl(var(--accent))]">
                  <span>Bundle savings</span>
                  <span className="tabular-nums">−{formatKes(savings)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">Subtotal</span>
                <span className="text-lg font-medium tabular-nums">{formatKes(subtotal)}</span>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Shipping &amp; taxes calculated at checkout.
              </p>
              <Link
                href="/cart"
                onClick={close}
                className="block w-full rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-center text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--background))] transition hover:opacity-90"
              >
                Review cart
              </Link>
              <button
                type="button"
                onClick={close}
                className="block w-full text-center text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Continue shopping
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
