'use client'

/**
 * Hero — the headline section above the fold.
 *
 * Copy comes from the server-side `getSection('home_hero')` call in
 * `src/app/(public)/page.tsx`, which falls back to in-code defaults if the
 * DB row is missing or malformed. Admin-editable via
 * `/admin/content/site/home_hero`.
 *
 * The component itself stays client-side because of the bottle rotation
 * logic — it crossfades through 5 fragrances on a 6.5s interval, respecting
 * `prefers-reduced-motion`. The non-LCP images are deferred until after
 * hydration so the initial paint ships only the priority bottle.
 */

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { FRAGRANCES } from '@/lib/catalog/fragrance-meta'
import { type HeroContent } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

const ROTATION_MS = 6500
const HERO_PICKS = [
  'ocean-desire',
  'crimson-noir',
  'sunset-bliss',
  'afar',
  'vanilla-smoke',
] as const

export function Hero({ copy }: { copy: HeroContent }) {
  const picks = HERO_PICKS.map((slug) => FRAGRANCES.find((f) => f.slug === slug)!).filter(Boolean)
  const [index, setIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const current = picks[index] ?? picks[0]

  // Defer the non-LCP hero images until after hydration so the initial paint
  // ships ONE bottle image, not five — cuts LCP + Speed Index on mobile / 4G.
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % picks.length), ROTATION_MS)
    return () => clearInterval(id)
  }, [picks.length])

  if (!current) return null

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

          {/* Rotating fragrance card — stacked, crossfade by opacity */}
          <div className="mt-10 flex items-center gap-5">
            <div className="h-px flex-1 bg-gradient-to-r from-[hsl(var(--primary))]/60 to-transparent" />
            <div className="relative h-[5.5rem] w-56 text-right">
              {picks.map((p, i) => (
                <div
                  key={p.slug}
                  aria-hidden={i !== index}
                  className={`absolute inset-0 transition-opacity duration-[900ms] ease-out ${
                    i === index ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                    {copy.rotatingLabel}
                  </p>
                  <p className="mt-1 font-serif text-xl text-[hsl(var(--foreground))]">
                    {p.name}
                  </p>
                  <p className="mt-1 text-xs italic text-[hsl(var(--primary))]">
                    {p.tagline}
                  </p>
                </div>
              ))}
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

          <div className="mt-10 flex items-center gap-2">
            {picks.map((p, i) => (
              <button
                key={p.slug}
                onClick={() => setIndex(i)}
                aria-label={`Show ${p.name}`}
                className={`h-1 rounded-full transition-all ${
                  i === index ? 'w-10 bg-[hsl(var(--primary))]' : 'w-4 bg-[hsl(var(--border))]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottle — all picks stacked, crossfade by opacity */}
        <div className="relative lg:col-span-6">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[580px]">
            {picks.map((p, i) => {
              // Only the LCP image (first) is in the initial paint; the rest
              // mount after hydration.
              if (!mounted && i !== 0) return null
              return (
                <Image
                  key={p.slug}
                  src={p.image}
                  alt={p.name}
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : 'lazy'}
                  sizes="(max-width: 1024px) 90vw, 520px"
                  className={`absolute inset-0 object-contain drop-shadow-[0_24px_50px_rgba(60,42,28,0.22)] transition-opacity duration-[900ms] ease-out ${
                    i === index ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )
            })}
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
