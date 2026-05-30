/**
 * ProductReviews — renders published reviews tied to a specific product
 * via homepage_reviews.product_id (migration 038). Renders nothing when
 * the source is unreachable OR when no published rows exist for this
 * product, so a freshly-added product silently degrades.
 */

import { getProductReviews } from '@/lib/home/social-proof'

export async function ProductReviews({ productId }: { productId: number }) {
  const reviews = (await getProductReviews(productId)) ?? []
  if (reviews.length === 0) return null

  return (
    <section className="mt-16 border-t border-[hsl(var(--border))] pt-12">
      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
        Worn, and remembered
      </p>
      <h2 className="mt-3 text-2xl font-light tracking-tight text-[hsl(var(--foreground))]">
        From those who wear it
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {reviews.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-6"
          >
            <blockquote className="font-serif text-base italic leading-relaxed text-[hsl(var(--foreground))]/90">
              &ldquo;{r.quote}&rdquo;
            </blockquote>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
              {r.authorName}
              {r.authorCity ? ` · ${r.authorCity}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
