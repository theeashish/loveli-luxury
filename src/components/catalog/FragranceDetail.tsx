import type { FragranceMetaDto } from '@/lib/catalog/types'

/**
 * Editorial fragrance detail block for the product page: notes pyramid,
 * performance, occasions, story, scent family, inspired-by. Every section
 * renders only when its data is present, so a product with partial (or no)
 * metadata degrades gracefully — the whole block disappears when empty.
 */

function hasContent(m: FragranceMetaDto): boolean {
  return (
    m.topNotes.length > 0 ||
    m.heartNotes.length > 0 ||
    m.baseNotes.length > 0 ||
    m.occasions.length > 0 ||
    Boolean(
      m.longevity || m.projection || m.climateNote || m.story || m.scentFamily || m.inspiredBy,
    )
  )
}

/**
 * One row of the notes pyramid. Wider widthClass at the base, narrower at
 * the top — gives the section a clear visual silhouette without a heavy
 * graphic. The note pills sit inline so the row reads as a single phrase.
 */
function PyramidTier({
  label,
  notes,
  widthClass,
}: {
  label: string
  notes: string[]
  widthClass: string
}) {
  return (
    <div
      className={`${widthClass} rounded-lg border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 px-6 py-4 text-center`}
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--foreground))]">
        {notes.join(' · ')}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[hsl(var(--foreground))]">{value}</dd>
    </div>
  )
}

export function FragranceDetail({ meta }: { meta: FragranceMetaDto | null }) {
  if (!meta || !hasContent(meta)) return null

  const hasNotes =
    meta.topNotes.length > 0 || meta.heartNotes.length > 0 || meta.baseNotes.length > 0
  const hasPerformance = Boolean(meta.longevity || meta.projection || meta.climateNote)

  return (
    <section className="mt-16 border-t border-[hsl(var(--border))] pt-12">
      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">The fragrance</p>

      {hasNotes ? (
        <div className="mt-6">
          <h2 className="text-2xl font-light tracking-tight text-[hsl(var(--foreground))]">
            The notes pyramid
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
            Top notes greet you first. Heart notes settle in. Base notes are what
            stays — the impression a fragrance leaves on the room and the day.
          </p>

          {/* Pyramid: top is narrowest, base is widest. Each tier is centered
              and indented so the silhouette reads as a triangle. */}
          <div className="mt-8 space-y-3">
            {meta.topNotes.length > 0 ? (
              <PyramidTier
                label="Top"
                notes={meta.topNotes}
                widthClass="mx-auto max-w-md"
              />
            ) : null}
            {meta.heartNotes.length > 0 ? (
              <PyramidTier
                label="Heart"
                notes={meta.heartNotes}
                widthClass="mx-auto max-w-xl"
              />
            ) : null}
            {meta.baseNotes.length > 0 ? (
              <PyramidTier
                label="Base"
                notes={meta.baseNotes}
                widthClass="mx-auto max-w-2xl"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {hasPerformance ? (
        <dl className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Stat label="Longevity" value={meta.longevity} />
          <Stat label="Projection" value={meta.projection} />
          <Stat label="Climate" value={meta.climateNote} />
        </dl>
      ) : null}

      {meta.occasions.length > 0 ? (
        <div className="mt-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Wear it for
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {meta.occasions.map((occasion, i) => (
              <li
                key={i}
                className="rounded-md border border-[hsl(var(--border))] px-3 py-1 text-xs text-[hsl(var(--foreground))]"
              >
                {occasion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {meta.story ? (
        <div className="mt-12 max-w-2xl">
          <h2 className="text-2xl font-light tracking-tight text-[hsl(var(--foreground))]">
            The story
          </h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {meta.story}
          </p>
        </div>
      ) : null}

      {meta.scentFamily || meta.inspiredBy ? (
        <p className="mt-10 text-xs text-[hsl(var(--muted-foreground))]">
          {meta.scentFamily ? (
            <>
              Scent family:{' '}
              <span className="text-[hsl(var(--foreground))]">{meta.scentFamily}</span>
            </>
          ) : null}
          {meta.scentFamily && meta.inspiredBy ? ' · ' : null}
          {meta.inspiredBy ? (
            <>
              Inspired by:{' '}
              <span className="text-[hsl(var(--foreground))]">{meta.inspiredBy}</span>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}
