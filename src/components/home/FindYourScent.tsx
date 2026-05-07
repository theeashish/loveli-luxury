'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FRAGRANCES, type FragranceMeta } from '@/lib/catalog/fragrance-meta'

type Step = {
  prompt: string
  options: { label: string; tag: FragranceMeta['vibe'] }[]
}

const STEPS: readonly Step[] = [
  {
    prompt: 'How do you want to enter the room?',
    options: [
      { label: 'Quietly, but unforgettably', tag: 'soft' },
      { label: 'Like the door just opened on a story', tag: 'mysterious' },
      { label: 'Sun-warm, smiling', tag: 'fresh' },
      { label: 'Tailored. Decided.', tag: 'bold' },
    ],
  },
  {
    prompt: 'Pick a time of day:',
    options: [
      { label: 'First light through linen curtains', tag: 'fresh' },
      { label: 'Gold hour — almost dusk', tag: 'warm' },
      { label: 'Late, candlelit, low music', tag: 'mysterious' },
      { label: 'High noon, somewhere by the sea', tag: 'fresh' },
    ],
  },
  {
    prompt: 'And finally — your evening looks like:',
    options: [
      { label: 'Slow dinner, longer conversation', tag: 'warm' },
      { label: 'A single glass, a balcony, a friend', tag: 'soft' },
      { label: 'A room you walked into and changed', tag: 'bold' },
      { label: 'A walk you take alone, on purpose', tag: 'mysterious' },
    ],
  },
]

function recommend(tags: FragranceMeta['vibe'][]): FragranceMeta {
  const score = new Map<string, number>()
  for (const t of tags) score.set(t, (score.get(t) ?? 0) + 1)
  const winner = [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as FragranceMeta['vibe']
  const match = FRAGRANCES.find((f) => f.vibe === winner)
  return match ?? FRAGRANCES[0]!
}

export function FindYourScent() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<FragranceMeta['vibe'][]>([])
  const result = useMemo(
    () => (step >= STEPS.length ? recommend(answers) : null),
    [answers, step],
  )

  const reset = () => {
    setStep(0)
    setAnswers([])
  }

  return (
    <section className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8 }}
          className="mb-14 text-center"
        >
          <p className="text-eyebrow">Find your scent</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
            A small ritual,{' '}
            <em className="italic text-[hsl(var(--primary))]">three quiet questions</em>.
          </h2>
        </motion.header>

        <div className="rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/30 p-8 md:p-12">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.7 }}
                className="grid grid-cols-1 items-center gap-10 md:grid-cols-2"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-md">
                  <Image
                    src={result.image}
                    alt={result.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 480px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-eyebrow">Your scent</p>
                  <h3 className="mt-3 font-serif text-4xl">{result.name}</h3>
                  <p className="mt-2 italic text-[hsl(var(--primary))]">{result.tagline}</p>
                  <p className="mt-6 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {result.notes}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed">{result.mood}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={`/p/${result.slug}`}
                      className="rounded-full bg-[hsl(var(--primary))] px-7 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary-foreground))] transition hover:scale-[1.02]"
                    >
                      Meet {result.name}
                    </Link>
                    <button
                      onClick={reset}
                      className="text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                  Question {step + 1} of {STEPS.length}
                </p>
                <h3 className="mt-3 font-serif text-3xl md:text-4xl">{STEPS[step]!.prompt}</h3>
                <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {STEPS[step]!.options.map((o, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setAnswers((prev) => [...prev, o.tag])
                        setStep((s) => s + 1)
                      }}
                      className="group rounded-md border border-[hsl(var(--border))] px-5 py-4 text-left text-sm transition hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5"
                    >
                      <span className="block transition group-hover:text-[hsl(var(--primary))]">
                        {o.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
