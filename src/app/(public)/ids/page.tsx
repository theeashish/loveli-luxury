import type { Metadata } from 'next'
import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'
import { EditorialPhotoFrame } from '@/components/editorial/EditorialPhotoFrame'
import { publicEnv } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Income Disclosure | Loveli Luxury Scents',
  description:
    'A factual view of verified partner earnings distribution, methodology, and programme rules.',
  alternates: { canonical: '/ids' },
  openGraph: {
    title: 'Income Disclosure | Loveli Luxury Scents',
    description:
      'Verified partner earnings distribution, methodology, and programme rules. Transparent, factual, never projections.',
    type: 'website',
    url: '/ids',
  },
}

// This page stays intentionally conservative: its purpose is to disclose
// verified earnings reality, not to market opportunity or project outcomes.
export const revalidate = false

export default async function IncomeDisclosurePage() {
  const copy = await getSection('partner_ids')
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Income disclosure',
    description: copy.lead,
    url: `${baseUrl}/ids`,
    isPartOf: { '@type': 'WebSite', name: 'Loveli Luxury Scents', url: baseUrl },
  }

  return (
    <main>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden border-b border-[hsl(var(--border))]/70">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-[hsl(var(--primary))]/[0.06] blur-3xl" />
          <div className="absolute right-[8%] top-[-8rem] h-72 w-72 rounded-full border border-[hsl(var(--primary))]/15" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.65fr)] md:items-end md:py-24">
          <header className="max-w-3xl">
            <p className="text-eyebrow">{copy.eyebrow}</p>
            <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-tight text-[hsl(var(--foreground))] md:text-6xl">
              <HighlightText text={copy.headline} />
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              {copy.lead}
            </p>
            <p className="mt-8 text-[10px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--primary))]">
              {copy.periodLabel}
            </p>
          </header>
          <EditorialPhotoFrame
            src={copy.photo?.url}
            alt={copy.photo?.alt}
            label="Earnings in context"
            caption={copy.photo?.caption}
            monogram="ID"
            className="mx-auto w-full max-w-sm"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="flex flex-col justify-between gap-5 border-b border-[hsl(var(--border))] pb-8 md:flex-row md:items-end">
          <div>
            <p className="text-eyebrow">Verified distribution</p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              The numbers, without a sales pitch.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-[hsl(var(--muted-foreground))]">
            These figures describe the reporting period only. They are neither estimates nor promises of future earnings.
          </p>
        </div>

        <div aria-label="Earnings distribution" className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {copy.stats.map((stat, index) => (
            <article
              key={stat.label}
              className="relative overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 md:p-7"
            >
              <span className="absolute right-6 top-6 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="max-w-[15rem] text-[10px] font-medium uppercase tracking-[0.24em] text-[hsl(var(--primary))]">
                {stat.label}
              </p>
              <p className="mt-5 font-serif text-4xl tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
                {stat.value}
              </p>
              <p className="mt-5 max-w-xl border-t border-[hsl(var(--border))] pt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                {stat.sub}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:py-20">
          <div>
            <p className="text-eyebrow">Methodology</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))]">
              How the figures are read.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
            {copy.methodology}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-24">
          <div>
            <p className="text-eyebrow">Programme rules</p>
            <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))]">
              What the programme will not compromise on.
            </h2>
          </div>
          <ol className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
            {copy.rules.map((rule, index) => (
              <li key={rule} className="grid gap-4 py-6 md:grid-cols-[3.5rem_minmax(0,1fr)] md:gap-6">
                <span className="text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="text-base leading-7 text-[hsl(var(--foreground))]">{rule}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="max-w-3xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{copy.footnote}</p>
        </div>
      </footer>
    </main>
  )
}
