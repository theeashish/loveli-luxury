'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { FragranceMetaDto } from '@/lib/catalog/types'
import { upsertProductFragranceMeta } from '@/lib/catalog/fragrance-actions'

function linesToArray(s: string): string[] {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}
function arrayToLines(a: string[]): string {
  return a.join('\n')
}
function emptyToNull(s: string): string | null {
  const t = s.trim()
  return t.length ? t : null
}

const inputCls =
  'mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none'
const labelCls = 'text-sm font-medium text-neutral-700'

export function AdminFragranceMetaEditor({
  productId,
  initial,
}: {
  productId: number
  initial: FragranceMetaDto | null
}) {
  const [top, setTop] = useState(arrayToLines(initial?.topNotes ?? []))
  const [heart, setHeart] = useState(arrayToLines(initial?.heartNotes ?? []))
  const [base, setBase] = useState(arrayToLines(initial?.baseNotes ?? []))
  const [longevity, setLongevity] = useState(initial?.longevity ?? '')
  const [projection, setProjection] = useState(initial?.projection ?? '')
  const [climate, setClimate] = useState(initial?.climateNote ?? '')
  const [occasions, setOccasions] = useState(arrayToLines(initial?.occasions ?? []))
  const [story, setStory] = useState(initial?.story ?? '')
  const [family, setFamily] = useState(initial?.scentFamily ?? '')
  const [inspired, setInspired] = useState(initial?.inspiredBy ?? '')
  const [pending, startTransition] = useTransition()

  const onSave = () => {
    startTransition(async () => {
      const res = await upsertProductFragranceMeta({
        productId,
        topNotes: linesToArray(top),
        heartNotes: linesToArray(heart),
        baseNotes: linesToArray(base),
        longevity: emptyToNull(longevity),
        projection: emptyToNull(projection),
        climateNote: emptyToNull(climate),
        occasions: linesToArray(occasions),
        story: emptyToNull(story),
        scentFamily: emptyToNull(family),
        inspiredBy: emptyToNull(inspired),
      })
      if ('error' in res) {
        toast.error('Could not save fragrance detail', { description: res.error })
      } else {
        toast.success('Fragrance detail saved')
      }
    })
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold text-neutral-900">Fragrance detail</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Shown on the product page. One note per line. Leave a field blank to hide that section.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Top notes</label>
          <textarea
            className={inputCls}
            rows={4}
            value={top}
            onChange={(e) => setTop(e.target.value)}
            placeholder={'Bergamot\nPink pepper'}
          />
        </div>
        <div>
          <label className={labelCls}>Heart notes</label>
          <textarea
            className={inputCls}
            rows={4}
            value={heart}
            onChange={(e) => setHeart(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Base notes</label>
          <textarea
            className={inputCls}
            rows={4}
            value={base}
            onChange={(e) => setBase(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Longevity</label>
          <input
            className={inputCls}
            value={longevity}
            onChange={(e) => setLongevity(e.target.value)}
            placeholder="8–10 hours"
          />
        </div>
        <div>
          <label className={labelCls}>Projection</label>
          <input
            className={inputCls}
            value={projection}
            onChange={(e) => setProjection(e.target.value)}
            placeholder="close / moderate / strong"
          />
        </div>
        <div>
          <label className={labelCls}>Scent family</label>
          <input
            className={inputCls}
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            placeholder="Woody oriental"
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Climate note</label>
          <textarea
            className={inputCls}
            rows={2}
            value={climate}
            onChange={(e) => setClimate(e.target.value)}
            placeholder="Holds up in Nairobi heat and humidity."
          />
        </div>
        <div>
          <label className={labelCls}>Occasions (one per line)</label>
          <textarea
            className={inputCls}
            rows={2}
            value={occasions}
            onChange={(e) => setOccasions(e.target.value)}
            placeholder={'Office\nEvening\nDate'}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className={labelCls}>Story</label>
        <textarea
          className={inputCls}
          rows={4}
          value={story}
          onChange={(e) => setStory(e.target.value)}
        />
      </div>

      <div className="mt-5">
        <label className={labelCls}>Inspired by</label>
        <input
          className={inputCls}
          value={inspired}
          onChange={(e) => setInspired(e.target.value)}
        />
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save fragrance detail'}
        </button>
      </div>
    </section>
  )
}
