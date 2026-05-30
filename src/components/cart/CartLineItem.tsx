'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { useCartStore } from '@/lib/cart/store'
import { lineKey } from '@/lib/cart/logic'
import { lineTotalMinor } from '@/lib/cart/selectors'
import type { CartLine } from '@/lib/cart/types'

export function CartLineItem({ line }: { line: CartLine }) {
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const key = lineKey(line)
  const href =
    line.kind === 'variant' ? `/p/${line.productSlug}` : `/bundles/${line.slug}`

  return (
    <li className="flex gap-4 border-b border-[hsl(var(--border))] py-4 last:border-b-0">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        {line.image ? (
          <Image src={line.image} alt={line.name} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={href}
              className="text-sm font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]"
            >
              {line.name}
            </Link>
            {line.kind === 'bundle' ? (
              <>
                <p className="mt-0.5 text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  Bundle
                </p>
                {line.contents && line.contents.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-l border-[hsl(var(--border))] pl-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {line.contents.map((item, i) => (
                      <li key={`${item.name}-${item.sizeMl}-${i}`} className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[10px] text-[hsl(var(--primary))]">×{item.qty}</span>
                        <span>
                          {item.name}
                          <span className="ml-1 text-[hsl(var(--muted-foreground))]/80">{item.sizeMl}ml</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="text-sm tabular-nums text-[hsl(var(--foreground))]">
            {formatKes(lineTotalMinor(line))}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="inline-flex items-center rounded-md border border-[hsl(var(--border))]">
            <button
              type="button"
              onClick={() => setQty(key, line.qty - 1)}
              aria-label="Decrease quantity"
              className="px-2.5 py-1 text-sm text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]"
            >
              −
            </button>
            <span className="min-w-[2rem] px-1 text-center text-sm tabular-nums">{line.qty}</span>
            <button
              type="button"
              onClick={() => setQty(key, line.qty + 1)}
              aria-label="Increase quantity"
              disabled={
                line.kind === 'variant' &&
                line.inventoryAtAdd !== null &&
                line.qty >= line.inventoryAtAdd
              }
              className="px-2.5 py-1 text-sm text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => remove(key)}
            className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))]"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}
