'use client'

import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { useCartStore } from '@/lib/cart/store'
import {
  subtotalMinor,
  totalBundleSavingsMinor,
  totalQty,
} from '@/lib/cart/selectors'
import { CartLineItem } from './CartLineItem'

export function CartPageClient() {
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const lines = useCartStore((s) => s.lines)
  const clear = useCartStore((s) => s.clear)

  // Pre-hydration: render a minimal skeleton so the layout doesn't jump.
  if (!hasHydrated) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-light tracking-tight">Cart</h1>
        <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
      </div>
    )
  }

  const qty = totalQty({ lines })
  const subtotal = subtotalMinor({ lines })
  const savings = totalBundleSavingsMinor({ lines })

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Review</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">Cart</h1>
        <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
          {qty === 0
            ? 'Your cart is empty.'
            : `${qty} item${qty === 1 ? '' : 's'} ready for checkout.`}
        </p>
      </header>

      {lines.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-8 py-16 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Nothing in your cart yet.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-block rounded-md border border-[hsl(var(--border))] px-6 py-3 text-xs uppercase tracking-[0.15em] text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))]"
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]">
          <ul className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-6">
            {lines.map((line) => (
              <CartLineItem
                key={line.kind === 'variant' ? `v${line.variantId}` : `b${line.bundleId}`}
                line={line}
              />
            ))}
          </ul>

          <aside className="self-start rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
            <h2 className="mb-5 text-base font-medium">Order summary</h2>
            <dl className="space-y-3 text-sm">
              {savings > 0n ? (
                <div className="flex items-center justify-between text-[hsl(var(--accent))]">
                  <dt className="text-xs uppercase tracking-[0.15em]">Bundle savings</dt>
                  <dd className="tabular-nums">−{formatKes(savings)}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <dt className="text-[hsl(var(--muted-foreground))]">Subtotal</dt>
                <dd className="tabular-nums">{formatKes(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
                <dt>Shipping</dt>
                <dd>Calculated at checkout</dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-[hsl(var(--border))] pt-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estimated total</span>
                <span className="text-xl font-medium tabular-nums">{formatKes(subtotal)}</span>
              </div>
            </div>
            <button
              type="button"
              disabled
              title="Checkout lands in Phase 3"
              className="mt-6 w-full cursor-not-allowed rounded-md bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))] opacity-60"
            >
              Continue to checkout
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Empty the cart?')) clear()
              }}
              className="mt-4 block w-full text-center text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
            >
              Empty cart
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
