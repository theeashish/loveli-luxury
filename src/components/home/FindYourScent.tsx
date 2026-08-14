'use client'

/**
 * Find-your-scent â€” homepage quiz.
 *
 * Copy comes from the server-side `getSection('home_find_your_scent')` call
 * in `src/app/(public)/page.tsx`, which falls back to in-code defaults if the
 * DB row is missing or malformed. Admin-editable via
 * `/admin/content/site/home_find_your_scent`.
 *
 * The component stays client-side because of the step / answer state â€” the
 * matching engine still picks a fragrance from FRAGRANCES by the option's
 * vibe tag (kept in code; the labels are the editable part).
 */

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FRAGRANCES, type FragranceMeta } from '@/lib/catalog/fragrance-meta'
import { type FindYourScentContent } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

function recommend(tags: FragranceMeta['vibe'][]): FragranceMeta {
  const score = new Map<string, number>()
  for (const t of tags) score.set(t, (score.get(t) ?? 0) + 1)
  const winner = [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as FragranceMeta['vibe']
  const match = FRAGRANCES.find((f) => f.vibe === winner)
  return match ?? FRAGRANCES[0]!
}

export function FindYourScent({ copy }: { copy: FindYourScentContent }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<FragranceMeta['vibe'][]>([])
  const total = copy.steps.length
  const result = useMemo(
    () => (step >= total ? recommend(answers) : null),
    [answers, step, total],
  )

  const reset = () => {
    setStep(0)
    setAnswers([])
  }

  const currentStep = copy.steps[step]

  return (
    <section className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <header className="mb-10 text-center md:mb-14">
          <p className="text-eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-5 font-serif text-4xl tracking-tight md:text-5xl">
            <HighlightText text={copy.headline} />
          </h2>
        </header>

        <div className="rounded-none border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/20 p-6 md:p-12 lg:p-14">
          <div className="mb-8 flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">Your ritual</p>
            <div className="flex items-center gap-2" aria-label={`Question ${Math.min(step + 1, total)} of ${total}`}>
              {copy.steps.map((_, index) => (
                <span
                  key={index}
                  className={index < Math.min(step + 1, total) ? 'h-px w-10 bg-[hsl(var(--primary))]' : 'h-px w-10 bg-[hsl(var(--border))]'}
                />
              ))}
            </div>
          </div>
          {result ? (
            <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
              <div className="relative aspect-[3/4] overflow-hidden">
                <Image
                  src={result.image}
                  alt={result.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-eyebrow">{copy.resultEyebrow}</p>
                <h3 className="mt-3 font-serif text-4xl">{result.name}</h3>
                <p className="mt-2 italic text-[hsl(var(--primary))]">{result.tagline}</p>
                <p className="mt-6 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                  {result.notes}
                </p>
                <p className="mt-4 text-sm leading-relaxed">{result.mood}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={`/p/${result.slug}`}
                    className="rounded-full bg-[hsl(var(--foreground))] px-7 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:scale-[1.02]"
                  >
                    {copy.meetCtaPrefix} {result.name}
                  </Link>
                  <button
                    onClick={reset}
                    className="text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline"
                  >
                    {copy.tryAgainLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : currentStep ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                Question {step + 1} of {total}
              </p>
              <h3 className="mt-3 font-serif text-3xl md:text-4xl">{currentStep.prompt}</h3>
              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentStep.options.map((o, i) => (
                  <button
                    key={`${step}-${i}`}
                    onClick={() => {
                      setAnswers((prev) => [...prev, o.tag])
                      setStep((s) => s + 1)
                    }}
                    className="group rounded-none border border-[hsl(var(--border))] px-5 py-4 text-left text-sm transition-colors duration-200 hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] focus-visible:ring-offset-2"
                  >
                    <span className="block transition group-hover:text-[hsl(var(--primary))]">
                      {o.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
