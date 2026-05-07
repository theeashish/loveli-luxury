'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const ITEMS = [
  {
    q: 'How long does a Loveli Luxury fragrance last?',
    a: 'Eau de Parfum concentration. Expect 8–12 hours on skin and even longer on fabric, with a refined dry-down that softens through the day.',
  },
  {
    q: 'Is delivery available outside Nairobi?',
    a: 'Yes — we ship across Kenya and to neighbouring countries. Free delivery in Nairobi on orders above Kes 5,000.',
  },
  {
    q: 'Are these bottles refillable?',
    a: 'Each 30ml and 50ml bottle is designed to be cherished. Refill programs for our distributor partners launch in early 2026.',
  },
  {
    q: 'Can I become a distributor?',
    a: 'Absolutely. We run a 7-level commission structure with monthly salary qualification. Start with any starter package — there is no joining fee.',
  },
  {
    q: 'Are your fragrances tested on animals?',
    a: 'Never. Our blends are vegan-friendly and cruelty-free, and we work only with suppliers who hold the same standard.',
  },
] as const

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section
      id="faq"
      className="relative border-t border-[hsl(var(--border))]/60 py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          className="mb-12 text-center"
        >
          <p className="text-eyebrow">Quiet answers</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
            Things people <em className="italic text-[hsl(var(--primary))]">ask</em>.
          </h2>
        </motion.header>

        <div className="divide-y divide-[hsl(var(--border))]/60 border-y border-[hsl(var(--border))]/60">
          {ITEMS.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left transition hover:text-[hsl(var(--primary))]"
                >
                  <span className="font-serif text-lg md:text-xl">{item.q}</span>
                  <span
                    className={`text-[hsl(var(--primary))] transition-transform duration-500 ${
                      isOpen ? 'rotate-45' : ''
                    }`}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pr-10 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
