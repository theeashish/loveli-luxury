/**
 * FAQ — bottom-of-homepage Q&A.
 *
 * Content is admin-editable via `/admin/content/site/home_faq`. Falls back
 * to FAQ_DEFAULTS in lib/content/site.ts if the DB row is missing or
 * malformed, so a bad edit can never break the page.
 */

import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

export async function FAQ() {
  const content = await getSection('home_faq')

  return (
    <section
      id="faq"
      className="relative border-t border-[hsl(var(--border))]/60 py-28 md:py-40 lg:py-48"
    >
      <div className="mx-auto max-w-3xl px-6">
        <header className="mb-16 text-center md:mb-24">
          <p className="text-eyebrow">{content.eyebrow}</p>
          <h2 className="mt-5 font-serif text-4xl tracking-tight md:text-5xl">
            <HighlightText text={content.headline} />
          </h2>
        </header>

        <div className="divide-y divide-[hsl(var(--border))]/60 border-y border-[hsl(var(--border))]/60">
          {content.items.map((item, i) => (
            <details
              key={item.q}
              {...(i === 0 ? { open: true } : {})}
              className="group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left transition hover:text-[hsl(var(--primary))]">
                <span className="font-serif text-lg md:text-xl">{item.q}</span>
                <span
                  aria-hidden
                  className="text-[hsl(var(--primary))] transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-6 pr-10 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
