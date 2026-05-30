/**
 * Fragrance philosophy — editorial statement on the craft (brand brief
 * homepage section #7). Distinct from Story (origin): this is about the
 * scent experience itself — the dry-down, longevity, the idea of presence.
 *
 * Content is admin-editable via `/admin/content/site/home_philosophy`.
 * Falls back to PHILOSOPHY_DEFAULTS in lib/content/site.ts if the DB row
 * is missing or malformed.
 */

import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

export async function FragrancePhilosophy() {
  const content = await getSection('home_philosophy')

  return (
    <section className="relative border-t border-[hsl(var(--border))]/60 py-32 md:py-48 lg:py-56">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-eyebrow">{content.eyebrow}</p>
        <h2 className="mt-5 font-serif text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.12] tracking-tight">
          <HighlightText text={content.headline} />
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          {content.body}
        </p>
        <blockquote className="mx-auto mt-12 max-w-2xl border-l-2 border-[hsl(var(--primary))]/50 pl-6 text-left font-serif text-2xl italic leading-relaxed md:text-3xl">
          &ldquo;{content.quote}&rdquo;
        </blockquote>
      </div>
    </section>
  )
}
