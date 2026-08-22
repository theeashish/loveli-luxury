/**
 * Editorial hero — a warm, image-led campaign entrance for Loveli Luxury.
 * Copy remains sourced from the editable home_hero content section.
 */

import Link from 'next/link'
import Image from 'next/image'
import { FRAGRANCES } from '@/lib/catalog/fragrance-meta'
import { type HeroContent } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

const HERO_SLUG = 'ocean-desire'

export function Hero({ copy }: { copy: HeroContent }) {
  const bottle = FRAGRANCES.find((f) => f.slug === HERO_SLUG) ?? FRAGRANCES[0]
  if (!bottle) return null

  return (
    <section className="relative isolate overflow-hidden bg-[hsl(var(--brand-onyx))] text-[hsl(var(--brand-white))]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 72% at 80% 34%, hsl(var(--brand-gold) / 0.12) 0%, transparent 64%), radial-gradient(48% 60% at 8% 92%, hsl(var(--brand-white) / 0.05) 0%, transparent 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute right-[9%] top-[8%] h-64 w-64 rounded-full border border-[hsl(var(--primary)/0.18)] sm:h-96 sm:w-96" />
      <div className="relative mx-auto grid w-full min-w-0 min-h-[30rem] max-w-7xl grid-cols-1 lg:min-h-[37rem] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="loveli-reveal-up relative z-10 min-w-0 w-full max-w-full flex flex-col justify-center px-6 py-14 sm:py-18 lg:px-10 lg:py-20" style={{ maxWidth: 'calc(100vw - 3rem)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[hsl(var(--primary))]">{copy.eyebrow}</p>
          <h1 className="mt-6 min-w-0 w-full max-w-[calc(100vw-3rem)] break-words whitespace-normal font-serif text-[clamp(3rem,7.4vw,6.6rem)] leading-[0.88] tracking-[-0.055em] sm:max-w-2xl"><HighlightText text={copy.headline} /></h1>
          <p className="mt-7 min-w-0 w-full max-w-[calc(100vw-3rem)] break-words text-base leading-8 text-[hsl(var(--brand-silver))] sm:max-w-md sm:text-lg">{copy.subhead}</p>
          <div className="mt-8 flex w-full flex-col items-stretch gap-5 sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={copy.ctaHref} className="inline-flex w-full items-center justify-center bg-[hsl(var(--brand-gold))] px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--brand-onyx))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--brand-white))] focus-visible:outline-none sm:w-auto focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2">{copy.ctaLabel}</Link>
            <div className="min-w-0 w-full flex-1 border-l border-[hsl(var(--primary)/0.35)] pl-5 sm:w-auto sm:min-w-[10rem] sm:flex-none">
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--primary))]">{copy.rotatingLabel}</p>
              <p className="mt-1 font-serif text-2xl tracking-tight">{bottle.name}</p>
              <p className="mt-1 text-xs italic text-[hsl(var(--primary))]">{bottle.tagline}</p>
            </div>
          </div>
        </div>
        <div className="loveli-reveal-up relative min-w-0 min-h-[21rem] overflow-hidden sm:min-h-[27rem] lg:min-h-[37rem]">
          <div aria-hidden className="loveli-float absolute inset-x-[12%] bottom-[9%] h-16 rounded-[50%] bg-[hsl(var(--brand-gold)/0.24)] blur-2xl" />
          <Image src={bottle.image} alt={bottle.name} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="loveli-float object-contain p-8 sm:p-12 lg:p-14" />
          <div aria-hidden className="absolute bottom-[8%] left-[19%] right-[10%] h-px bg-[hsl(var(--primary)/0.35)]" />
          <p className="absolute bottom-[5%] right-[10%] text-[9px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--primary))]">Loveli Luxury Scents</p>
        </div>
      </div>
    </section>
  )
}
