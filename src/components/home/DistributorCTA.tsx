'use client'

import Link from 'next/link'
import { animate, motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

function CountUp({ to, suffix = '', duration = 1.6 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const ctrl = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => setV(n),
    })
    return () => ctrl.stop()
  }, [inView, to, duration])
  return <span ref={ref}>{Math.round(v)}{suffix}</span>
}

export function DistributorCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 100%, hsl(38 56% 60% / 0.16) 0%, transparent 70%)',
        }}
      />
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="text-eyebrow"
        >
          Join the family
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, delay: 0.1 }}
          className="mt-5 font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] tracking-tight"
        >
          Wear the brand. <em className="italic text-[hsl(var(--primary))]">Build the dream</em>.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, delay: 0.25 }}
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]"
        >
          No joining fee. Up to 100% retail margins, 7 levels of commission, monthly salary
          qualification, rank-up bonuses, and a path to car and travel incentives.
        </motion.p>

        <motion.ul
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, delay: 0.4 }}
          className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 text-left text-sm text-[hsl(var(--muted-foreground))] sm:grid-cols-4"
        >
          {[
            { node: <CountUp to={0} />, v: 'Joining fee' },
            { node: <CountUp to={7} />, v: 'Commission levels' },
            { node: <CountUp to={20} suffix="%" />, v: 'Direct partner cut' },
            { node: <><CountUp to={100} />k+</>, v: 'Rank-up bonuses' },
          ].map((s) => (
            <li key={s.v} className="text-center">
              <p className="font-serif text-3xl text-[hsl(var(--primary))]">{s.node}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em]">{s.v}</p>
            </li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, delay: 0.55 }}
          className="mt-12"
        >
          <Link
            href="/bundles"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--primary))] px-10 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary-foreground))] transition hover:scale-[1.02]"
          >
            <span className="relative z-10">Explore starter packages</span>
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
