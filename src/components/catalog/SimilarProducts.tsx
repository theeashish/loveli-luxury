/**
 * SimilarProducts — "Smells similar" cross-sell band on the PDP.
 *
 * Pulls up to 3 active products in the same scent_family. Renders nothing
 * if scent_family is null or no matches exist, so the section gracefully
 * disappears for products that haven't had their fragrance metadata filled
 * in or whose family is unique in the catalogue.
 */

import Image from 'next/image'
import Link from 'next/link'
import { getSimilarProducts } from '@/lib/catalog/similar'
import { formatKes } from '@/lib/money'

export async function SimilarProducts({
  productId,
  scentFamily,
}: {
  productId: number
  scentFamily: string | null
}) {
  const items = await getSimilarProducts(productId, scentFamily)
  if (items.length === 0) return null

  return (
    <section className="mt-16 border-t border-[hsl(var(--border))] pt-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
            Smells similar
          </p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-[hsl(var(--foreground))]">
            More in the {scentFamily} family
          </h2>
        </div>
        <Link
          href="/shop"
          className="hidden text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline md:inline"
        >
          See all →
        </Link>
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {items.map((p) => (
          <li key={p.id}>
            <Link
              href={`/p/${p.slug}`}
              className="group block overflow-hidden rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 transition hover:border-[hsl(var(--primary))]/50"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    quality={65}
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                    No image yet
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-serif text-lg text-[hsl(var(--foreground))]">{p.name}</h3>
                {p.fromMinor ? (
                  <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                    From {formatKes(BigInt(p.fromMinor))}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
