'use client'

import { motion } from 'framer-motion'

export function Story() {
  return (
    <section
      id="story"
      className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(50% 60% at 80% 20%, hsl(38 56% 60% / 0.10) 0%, transparent 60%), radial-gradient(40% 50% at 10% 90%, hsl(0 55% 45% / 0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto max-w-3xl px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="text-eyebrow"
        >
          Our story
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="mt-5 font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.1] tracking-tight"
        >
          Born in Nairobi.{' '}
          <em className="italic text-[hsl(var(--primary))]">Bottled</em> with intention.{' '}
          Sent into the world to be unforgettable.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, delay: 0.25 }}
          className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]"
        >
          Loveli Luxury Scents began with a small idea — that fragrance should feel like a love
          letter, not a label. We blend in small batches, source carefully, and trust the long
          finish. Every bottle is hand-finished, signed, and sent.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, delay: 0.4 }}
          className="mx-auto mt-14 grid max-w-2xl grid-cols-1 gap-8 text-left sm:grid-cols-3"
        >
          {[
            { k: 'Hand-blended', v: 'Small batches, never machine-rushed.' },
            { k: 'Long-wear', v: '8–12 hours on skin. Eau de Parfum strength.' },
            { k: 'Made in Kenya', v: 'Designed and finished in Nairobi.' },
          ].map((item) => (
            <div key={item.k}>
              <p className="text-eyebrow">{item.k}</p>
              <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {item.v}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
