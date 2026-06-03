/**
 * Hero — the headline section above the fold.
 *
 * Server Component. Copy comes from `getSection('home_hero')` in
 * `src/app/(public)/page.tsx`, which falls back to in-code defaults if the
 * DB row is missing or malformed. Admin-editable via
 * `/admin/content/site/home_hero`.
 *
 * Design (2026-06-03): single bottle showcase, no rotation. The earlier
 * 5-image client crossfade shipped Hero as `'use client'` plus an
 * interval-driven `useState`, and eagerly mounted all five fragrance
 * images after hydration (~330 KiB of image weight on the LCP route).
 * The owner authorised the perf trade-off on 2026-06-03; the brand brief
 * principle "UI restraint" favours one well-photographed signature anyway.
 * If the owner ever wants a hero rotation back, push it down into a
 * deferred client island so the LCP path stays static.
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
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(60% 50% at 78% 50%, hsl(38 40% 60% / 0.18) 0%, transparent 60%), radial-gradient(40% 40% at 12% 88%, hsl(19 35% 45% / 0.15) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto grid min-h-[90vh] max-w-7xl grid-cols-1 items-center gap-8 px-6 py-24 lg:grid-cols-12 lg:gap-16 lg:py-40">
        {/* Copy */}
        <div className="lg:col-span-6">
          <p className="text-eyebrow">{copy.eyebrow}</p>
          <h1 className="mt-5 whitespace-pre-line font-serif text-[clamp(2.75rem,7vw,5.5rem)] leading-[1.02] tracking-tight">
            <HighlightText text={copy.headline} />
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            {copy.subhead}
          </p>

          <div className="mt-10 flex items-center gap-5">
            <div className="h-px flex-1 bg-gradient-to-r from-[hsl(var(--primary))]/60 to-transparent" />
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                {copy.rotatingLabel}
              </p>
              <p className="mt-1 font-serif text-xl text-[hsl(var(--foreground))]">
                {bottle.name}
              </p>
              <p className="mt-1 text-xs italic text-[hsl(var(--primary))]">{bottle.tagline}</p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={copy.ctaHref}
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--foreground))] px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:scale-[1.02]"
            >
              <span className="relative z-10">{copy.ctaLabel}</span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </Link>
          </div>
        </div>

        {/* Bottle — single signature, server-rendered */}
        <div className="relative lg:col-span-6">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[580px]">
            <Image
              src={bottle.image}
              alt={bottle.name}
              fill
              priority
              sizes="(max-width: 1024px) 90vw, 520px"
              className="absolute inset-0 object-contain drop-shadow-[0_24px_50px_rgba(60,42,28,0.22)]"
            />
            <div
              aria-hidden
              className="absolute inset-x-10 -bottom-2 h-10 rounded-[50%] bg-[hsl(22_14%_13%/0.15)] blur-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
