import type { Metadata } from 'next'
import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'
import { publicEnv } from '@/lib/env'

/**
 * /ids — Income Disclosure Statement.
 *
 * Public page that publishes the verified earnings distribution across active
 * Loveli partners. Editorially the opposite of an income claim: it discloses
 * REALITY (median, % earning > 0, recoup rate, top 5%) so a prospective
 * partner can make an informed decision before they sign up.
 *
 * Content is admin-editable under partner_ids in /admin/content/site; the
 * code defaults render if the row is missing or malformed (the getSection
 * fallback in lib/content/site.ts). Locked principles are documented there
 * and surfaced in the admin editor's schema help.
 */

export const metadata: Metadata = {
  title: 'Income disclosure',
  description:
    'Verified earnings distribution across active Loveli Luxury Scents partners — median, % earning, recoup rate. Transparent, factual, never projections.',
  alternates: { canonical: '/ids' },
  openGraph: {
    title: 'Income disclosure — Loveli Luxury Scents',
    description:
      'Verified earnings distribution across active Loveli partners. Transparent, factual, never projections.',
    type: 'website',
    url: '/ids',
  },
}

// Cached forever; admin save actions call revalidatePath('/ids') to refresh.
export const revalidate = false

export default async function IncomeDisclosurePage() {
  const copy = await getSection('partner_ids')
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')

  // Lightweight WebPage JSON-LD so Google understands this page is an
  // editorial disclosure tied to the brand — not a marketing surface.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Income disclosure',
    description: copy.lead,
    url: `${baseUrl}/ids`,
    isPartOf: { '@type': 'WebSite', name: 'Loveli Luxury Scents', url: baseUrl },
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="mb-12">
        <p className="text-eyebrow">{copy.eyebrow}</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">
          <HighlightText text={copy.headline} />
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          {copy.lead}
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">
          {copy.periodLabel}
        </p>
      </header>

      <section
        aria-label="Earnings distribution"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2"
      >
        {copy.stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6"
          >
            <p className="text-eyebrow">{stat.label}</p>
            <p className="mt-3 font-serif text-3xl text-[hsl(var(--foreground))] md:text-4xl">
              {stat.value}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
              {stat.sub}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <p className="text-eyebrow">Methodology</p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {copy.methodology}
        </p>
      </section>

      <section className="mt-14">
        <p className="text-eyebrow">Rules of the program</p>
        <ul className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed">
          {copy.rules.map((rule) => (
            <li
              key={rule}
              className="border-l-2 border-[hsl(var(--primary))] pl-4 text-[hsl(var(--foreground))]"
            >
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 border-t border-[hsl(var(--border))] pt-8">
        <p className="max-w-2xl text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          {copy.footnote}
        </p>
      </footer>
    </main>
  )
}
