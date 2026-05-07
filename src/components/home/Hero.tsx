'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion'
import { FRAGRANCES } from '@/lib/catalog/fragrance-meta'
import { CursorSpotlight } from './CursorSpotlight'
import { KineticHeading, Slot } from '@/components/chrome/KineticHeading'
import { MagneticLink } from '@/components/chrome/MagneticLink'

const ROTATION_MS = 6500
const HERO_PICKS = ['ocean-desire', 'crimson-noir', 'sunset-bliss', 'afar', 'vanilla-smoke'] as const

export function Hero() {
  const reduce = useReducedMotion()
  const picks = HERO_PICKS.map((slug) => FRAGRANCES.find((f) => f.slug === slug)!).filter(Boolean)
  const [index, setIndex] = useState(0)
  const current = picks[index] ?? picks[0]

  const sectionRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const bottleY = useTransform(scrollYProgress, [0, 1], ['0%', '-22%'])
  const bottleScale = useTransform(scrollYProgress, [0, 1], [1, 1.06])
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', '14%'])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.2])

  if (!current) return null

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setIndex((i) => (i + 1) % picks.length), ROTATION_MS)
    return () => clearInterval(id)
  }, [reduce, picks.length])

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden">
      <CursorSpotlight />
      {/* Ambient gradient that breathes with the rotation. */}
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
        <motion.div
          style={reduce ? undefined : { y: copyY, opacity: copyOpacity }}
          className="lg:col-span-6"
        >
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="text-eyebrow"
          >
            Where love meets luxury
          </motion.p>
          <KineticHeading className="mt-5 font-serif text-[clamp(2.75rem,7vw,5.5rem)] leading-[1.02] tracking-tight">
            <Slot>The Scent of </Slot>
            <Slot italic gold>Elegance</Slot>
            <Slot>,</Slot>
            <br />
            <Slot>Bottled.</Slot>
          </KineticHeading>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.25 }}
            className="mt-7 max-w-md text-base leading-relaxed text-[hsl(var(--muted-foreground))]"
          >
            Hand-crafted Eau de Parfum, blended in small batches in Nairobi. Each bottle a quiet
            love letter to those who choose to live beautifully.
          </motion.p>

          {/* Rotating fragrance card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-10 flex items-center gap-5"
          >
            <div className="h-px flex-1 bg-gradient-to-r from-[hsl(var(--primary))]/60 to-transparent" />
            <AnimatePresence mode="wait">
              <motion.div
                key={current.slug}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.5 }}
                className="text-right"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                  Now featuring
                </p>
                <p className="mt-1 font-serif text-xl text-[hsl(var(--foreground))]">
                  {current.name}
                </p>
                <p className="mt-1 text-xs italic text-[hsl(var(--primary))]">{current.tagline}</p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.55 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <MagneticLink
              href="/shop"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--primary))] px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary-foreground))] transition hover:scale-[1.02]"
            >
              <span className="relative z-10">Shop the collection</span>
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            </MagneticLink>
            <Link
              href="/bundles"
              className="text-xs uppercase tracking-[0.25em] text-[hsl(var(--foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline"
            >
              Become a distributor →
            </Link>
          </motion.div>

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
        </motion.div>

        {/* Bottle */}
        <motion.div
          style={reduce ? undefined : { y: bottleY, scale: bottleScale }}
          className="relative lg:col-span-6"
        >
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[520px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.slug}
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.02, y: -16 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                <Image
                  src={current.image}
                  alt={current.name}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 90vw, 520px"
                  className="object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.55)]"
                />
              </motion.div>
            </AnimatePresence>
            {/* Soft floor reflection */}
            <div
              aria-hidden
              className="absolute inset-x-8 -bottom-2 h-12 rounded-[50%] bg-black/60 blur-2xl"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
