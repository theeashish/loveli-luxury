'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { FRAGRANCES } from '@/lib/catalog/fragrance-meta'

const ROTATION_MS = 6500
const HERO_PICKS = [
  'ocean-desire',
  'crimson-noir',
  'sunset-bliss',
  'afar',
  'vanilla-smoke',
] as const

export function Hero() {
  const picks = HERO_PICKS.map((slug) => FRAGRANCES.find((f) => f.slug === slug)!).filter(Boolean)
  const [index, setIndex] = useState(0)
  const current = picks[index] ?? picks[0]

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
            'radial-gradient(60% 50% at 78% 50%, hsl(38 56% 60% / 0.18) 0%, transparent 60%), radial-gradient(40% 40% at 12% 88%, hsl(0 55% 45% / 0.15) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto grid min-h-[88vh] max-w-7xl grid-cols-1 items-center gap-8 px-6 py-16 lg:grid-cols-12 lg:gap-12 lg:py-24">
        {/* Copy */}
        <div className="lg:col-span-6">
          <p className="text-eyebrow">Where love meets luxury</p>
          <h1 className="mt-5 font-serif text-[clamp(2.75rem,7vw,5.5rem)] leading-[1.02] tracking-tight">
            The Scent of{' '}
            <em className="italic text-[hsl(var(--primary))]">Elegance</em>,
            <br />
            Bottled.
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            Hand-crafted Eau de Parfum, blended in small batches in Nairobi. Each bottle a quiet
            love letter to those who choose to live beautifully.
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
                    Now featuring
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
              href="/shop"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--primary))] px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary-foreground))] transition hover:scale-[1.02]"
            >
              <span className="relative z-10">Shop the collection</span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </Link>
            <Link
              href="/distributors/signup"
              className="text-xs uppercase tracking-[0.25em] text-[hsl(var(--foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline"
            >
              Become a distributor →
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
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[520px]">
            {picks.map((p, i) => (
              <Image
                key={p.slug}
                src={p.image}
                alt={p.name}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 90vw, 520px"
                className={`absolute inset-0 object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.55)] transition-opacity duration-[900ms] ease-out ${
                  i === index ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div
              aria-hidden
              className="absolute inset-x-8 -bottom-2 h-12 rounded-[50%] bg-black/60 blur-2xl"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
