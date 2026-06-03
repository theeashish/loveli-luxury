import Image from 'next/image'
import Link from 'next/link'
import { FRAGRANCES, type FragranceMeta } from '@/lib/catalog/fragrance-meta'

function Card({ f }: { f: FragranceMeta }) {
  // Editorial layout: image on top, caption below — the "mondedesparfum.com"
  // look the brand brief references. No dark gradient overlay, no white text
  // on photograph. Lets future clean-render imagery breathe; lets current
  // images degrade gracefully without the overlay-over-baked-text problem.
  return (
    <Link
      href={`/p/${f.slug}`}
      className="group block transition"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-[hsl(var(--muted))]/40">
        <Image
          src={f.image}
          alt={f.name}
          fill
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 47vw, (max-width: 1536px) 31vw, 420px"
          quality={60}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          {f.family}
        </p>
        <h3 className="mt-2 font-serif text-2xl tracking-tight text-[hsl(var(--foreground))] transition group-hover:text-[hsl(var(--primary))]">
          {f.name}
        </h3>
        <p className="mt-1 text-sm italic text-[hsl(var(--muted-foreground))]">
          {f.tagline}
        </p>
      </div>
    </Link>
  )
}

export function FeaturedGrid() {
  return (
    <section className="relative border-t border-[hsl(var(--border))]/60 py-28 md:py-40 lg:py-48">
      <div className="mx-auto max-w-7xl px-6">
        <header className="mb-16 flex items-end justify-between gap-6 md:mb-24">
          <div>
            <p className="text-eyebrow">The collection</p>
            <h2 className="mt-5 font-serif text-4xl tracking-tight md:text-5xl">
              Nine stories,{' '}
              <em className="italic text-[hsl(var(--primary))]">one signature</em>.
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] underline-offset-8 transition hover:text-[hsl(var(--primary))] hover:underline md:inline"
          >
            View all →
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FRAGRANCES.map((f) => (
            <Card key={f.slug} f={f} />
          ))}
        </div>
      </div>
    </section>
  )
}
