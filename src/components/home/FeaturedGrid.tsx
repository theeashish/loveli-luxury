'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { FRAGRANCES, type FragranceMeta } from '@/lib/catalog/fragrance-meta'

function TiltCard({ f, delayMod }: { f: FragranceMeta; delayMod: number }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 180, damping: 20 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 180, damping: 20 })

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => {
    mx.set(0)
    my.set(0)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.7, delay: delayMod * 0.08, ease: [0.22, 1, 0.36, 1] }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="[transform-style:preserve-3d]"
    >
      <Link
        href={`/p/${f.slug}`}
        className="group relative block overflow-hidden rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 transition hover:border-[hsl(var(--primary))]/50"
      >
        <div className="relative aspect-[3/4] overflow-hidden">
          <Image
            src={f.image}
            alt={f.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-90" />
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(120% 60% at 50% 110%, hsl(38 56% 60% / 0.25) 0%, transparent 60%)',
            }}
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
            {f.family}
          </p>
          <h3 className="mt-1 font-serif text-2xl text-white">{f.name}</h3>
          <p className="mt-1 text-sm italic text-white/70">{f.tagline}</p>
          <p className="mt-3 max-h-0 overflow-hidden text-xs leading-relaxed text-white/60 transition-all duration-500 group-hover:max-h-20">
            {f.notes}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

export function FeaturedGrid() {
  return (
    <section className="relative border-t border-[hsl(var(--border))]/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 flex items-end justify-between gap-6"
        >
          <div>
            <p className="text-eyebrow">The collection</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
              Nine stories, <em className="italic text-[hsl(var(--primary))]">one signature</em>.
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline md:inline"
          >
            View all →
          </Link>
        </motion.header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FRAGRANCES.map((f, i) => (
            <TiltCard key={f.slug} f={f} delayMod={i % 3} />
          ))}
        </div>
      </div>
    </section>
  )
}
