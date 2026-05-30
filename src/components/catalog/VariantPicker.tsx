'use client'

import { useState } from 'react'
import { formatKes } from '@/lib/money'
import { AddToCartButton } from './AddToCartButton'
import { imageUrl } from '@/lib/catalog/storage'
import type { ProductDto, VariantDto } from '@/lib/catalog/types'
import type { CartLineInput } from '@/lib/cart/types'

export function VariantPicker({ product }: { product: ProductDto }) {
  const activeVariants = product.variants.filter((v) => v.isActive)

  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const inStock = activeVariants.find((v) => v.inventoryQty > 0)
    return inStock?.id ?? activeVariants[0]?.id ?? null
  })

  if (activeVariants.length === 0) {
    return (
      <p className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
        No sizes available right now. Check back soon.
      </p>
    )
  }

  const selected: VariantDto = activeVariants.find((v) => v.id === selectedId) ?? activeVariants[0]!
  const productImage = product.images.find((i) => i.isPrimary) ?? product.images[0] ?? null

  const line: CartLineInput = {
    kind: 'variant',
    variantId: selected.id,
    productSlug: product.slug,
    name: `${product.name} — ${selected.sizeMl}ml`,
    sizeMl: selected.sizeMl,
    unitPriceMinor: selected.retailPriceMinor,
    image: productImage ? imageUrl(productImage.storagePrefix, 'thumb') : null,
    inventoryAtAdd: selected.inventoryQty,
  }
  const soldOut = selected.inventoryQty <= 0

  return (
    <>
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
          Size
        </p>
        <div className="flex flex-wrap gap-2">
          {activeVariants.map((v) => {
            const isSelected = v.id === selected.id
            const oos = v.inventoryQty <= 0
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                disabled={oos}
                className={[
                  'rounded-md border px-4 py-2 text-sm font-medium transition',
                  isSelected
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]',
                  oos ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
              >
                {v.sizeMl}ml
                {oos ? <span className="ml-1.5 text-xs">(out)</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-light tabular-nums text-[hsl(var(--foreground))]">
          {formatKes(BigInt(selected.retailPriceMinor))}
        </p>
        {selected.inventoryQty > 0 && selected.inventoryQty <= 5 ? (
          <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--accent))]">
            Only {selected.inventoryQty} left
          </p>
        ) : null}
      </div>

      <AddToCartButton line={line} disabled={soldOut} />
    </div>

    {/* Persistent mobile add-to-cart bar (brief §6.12) */}
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 py-3 backdrop-blur md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="min-w-0">
        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
          {product.name} · {selected.sizeMl}ml
        </p>
        <p className="text-lg font-light tabular-nums text-[hsl(var(--foreground))]">
          {formatKes(BigInt(selected.retailPriceMinor))}
        </p>
      </div>
      <AddToCartButton
        line={line}
        disabled={soldOut}
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
    </>
  )
}
