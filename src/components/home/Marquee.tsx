'use client'

import { motion } from 'framer-motion'
import { FRAGRANCES } from '@/lib/catalog/fragrance-meta'

const SEP = '✦'

export function Marquee() {
  // Two passes side-by-side so the loop is seamless.
  const items = FRAGRANCES.map((f) => f.name.toUpperCase())
  const track = [...items, ...items]

  return (
    <section
      aria-hidden
      className="relative overflow-hidden border-y border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 py-5"
    >
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
      >
        {track.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="mx-8 inline-flex items-center gap-8 font-serif text-2xl tracking-[0.2em] text-[hsl(var(--muted-foreground))] md:text-3xl"
          >
            {name}
            <span className="text-[hsl(var(--primary))]">{SEP}</span>
          </span>
        ))}
      </motion.div>
    </section>
  )
}
