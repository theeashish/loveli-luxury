/**
 * Customer proof — first-wear reviews (brand brief homepage section #6).
 *
 * DB-backed + admin-managed via /admin/content/social-proof (migration 026).
 * FALLBACK_REVIEWS is used ONLY when the table is unreachable (e.g. before
 * migration 026 is applied) so the section keeps its shape during rollout.
 * Once the table exists, content is fully DB-driven: an empty published set
 * hides the section entirely.
 */

import { getPublishedReviews, type HomeReview } from '@/lib/home/social-proof'

const FALLBACK_REVIEWS: HomeReview[] = [
  {
    id: -1,
    quote:
      "I get asked what I'm wearing every single time. The dry-down is the part that stays with people.",
    authorName: 'A. M.',
    authorCity: 'Nairobi',
  },
  {
    id: -2,
    quote:
      'Lasted from morning meetings through dinner. Wrapped, sealed, delivered the next day.',
    authorName: 'W. K.',
    authorCity: 'Mombasa',
  },
  {
    id: -3,
    quote:
      'Subtle, but it lingers. Exactly the presence I wanted, nothing loud, just remembered.',
    authorName: 'L. A.',
    authorCity: 'Kisumu',
  },
]

export async function CustomerProof() {
  const fetched = await getPublishedReviews()
  // null = source unreachable (pre-migration) → fallback; [] = owner has no
  // published reviews → hide the section.
  const reviews = fetched ?? FALLBACK_REVIEWS
  if (reviews.length === 0) return null

  return (
    <section className="relative border-t border-[hsl(var(--border))]/60 py-28 md:py-40 lg:py-48">
      <div className="mx-auto max-w-6xl px-6">
        <header className="mb-16 text-center md:mb-24">
          <p className="text-eyebrow">In their words</p>
          <h2 className="mt-5 font-serif text-4xl tracking-tight md:text-5xl">
            Worn, and{' '}
            <em className="italic text-[hsl(var(--primary))]">remembered</em>.
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="flex h-full flex-col rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/30 p-7"
            >
              <blockquote className="flex-1 font-serif text-lg italic leading-relaxed text-[hsl(var(--foreground))]/90">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                {r.authorName}
                {r.authorCity ? ` · ${r.authorCity}` : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
