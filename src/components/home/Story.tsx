/**
 * Story — the brand origin block on the homepage.
 *
 * Content is admin-editable via `/admin/content/site/home_story`. Falls
 * back to STORY_DEFAULTS in lib/content/site.ts if the DB row is missing
 * or malformed.
 */

import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

export async function Story() {
  const content = await getSection('home_story')

  return (
    <section
      id="story"
      className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-32 md:py-48 lg:py-56"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(50% 60% at 80% 20%, hsl(38 40% 60% / 0.10) 0%, transparent 60%), radial-gradient(40% 50% at 10% 90%, hsl(19 35% 45% / 0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-eyebrow">{content.eyebrow}</p>
        <h2 className="mt-5 font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.1] tracking-tight">
          <HighlightText text={content.headline} />
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          {content.body}
        </p>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 text-left sm:grid-cols-3 md:mt-20">
          {content.stats.map((item) => (
            <div key={item.k}>
              <p className="text-eyebrow">{item.k}</p>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {item.v}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
