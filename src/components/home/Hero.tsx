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
    <section className="relative isolate overflow-hidden bg-[hsl(37_42%_90%)] text-[hsl(var(--brand-onyx))]">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 72% at 80% 34%, hsl(39 65% 96% / 0.95) 0%, transparent 64%), radial-gradient(48% 60% at 8% 92%, hsl(26 38% 78% / 0.45) 0%, transparent 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute right-[9%] top-[8%] h-64 w-64 rounded-full border border-[hsl(var(--primary)/0.18)] sm:h-96 sm:w-96" />
      <div className="relative mx-auto grid min-h-[30rem] max-w-7xl grid-cols-1 lg:min-h-[37rem] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="loveli-reveal-up relative z-10 flex flex-col justify-center px-6 py-14 sm:py-18 lg:px-10 lg:py-20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[hsl(var(--primary))]">{copy.eyebrow}</p>
          <h1 className="mt-6 max-w-2xl font-serif text-[clamp(3rem,7.4vw,6.6rem)] leading-[0.88] tracking-[-0.055em]"><HighlightText text={copy.headline} /></h1>
          <p className="mt-7 max-w-md text-base leading-8 text-[hsl(var(--muted-foreground))] sm:text-lg">{copy.subhead}</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link href={copy.ctaHref} className="inline-flex items-center justify-center bg-[hsl(var(--brand-onyx))] px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(38_52%_87%)] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2">{copy.ctaLabel}</Link>
            <div className="min-w-[10rem] border-l border-[hsl(var(--primary)/0.35)] pl-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--primary))]">{copy.rotatingLabel}</p>
              <p className="mt-1 font-serif text-2xl tracking-tight">{bottle.name}</p>
              <p className="mt-1 text-xs italic text-[hsl(var(--primary))]">{bottle.tagline}</p>
            </div>
          </div>
        </div>
        <div className="loveli-reveal-up relative min-h-[21rem] overflow-hidden sm:min-h-[27rem] lg:min-h-[37rem]">
          <div aria-hidden className="loveli-float absolute inset-x-[12%] bottom-[9%] h-16 rounded-[50%] bg-[hsl(var(--brand-onyx)/0.65)] blur-2xl" />
          <Image src={bottle.image} alt={bottle.name} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="loveli-float object-contain p-8 mix-blend-multiply sm:p-12 lg:p-14" />
          <div aria-hidden className="absolute bottom-[8%] left-[19%] right-[10%] h-px bg-[hsl(var(--primary)/0.35)]" />
          <p className="absolute bottom-[5%] right-[10%] text-[9px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--primary))]">Loveli Luxury Scents</p>
        </div>
      </div>
    </section>
  )
}
