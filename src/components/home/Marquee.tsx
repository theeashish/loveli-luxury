/**
 * Marquee — brand strip on the homepage.
 *
 * Content is admin-editable via `/admin/content/site/home_marquee`. Falls
 * back to MARQUEE_DEFAULTS in lib/content/site.ts if the DB row is missing
 * or malformed.
 */

import { getSection } from '@/lib/content/site'

export async function Marquee() {
  const content = await getSection('home_marquee')
  // Two passes side-by-side so the CSS-only animation loop is seamless.
  const track = [...content.items, ...content.items]

  return (
    <section
      aria-hidden
      className="relative overflow-hidden border-y border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 py-5"
    >
      <div className="flex whitespace-nowrap animate-marquee-x motion-reduce:animate-none">
        {track.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="mx-8 inline-flex items-center gap-8 font-serif text-2xl tracking-[0.2em] text-[hsl(var(--muted-foreground))] md:text-3xl"
          >
            {name}
            <span className="text-[hsl(var(--primary))]">{content.separator}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
