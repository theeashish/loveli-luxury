import Image from 'next/image'
import Link from 'next/link'
import { FRAGRANCES, type FragranceMeta } from '@/lib/catalog/fragrance-meta'

function Card({ f }: { f: FragranceMeta }) {
  return (
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
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-90" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          {f.family}
        </p>
        <h3 className="mt-1 font-serif text-2xl text-white">{f.name}</h3>
        <p className="mt-1 text-sm italic text-white/70">{f.tagline}</p>
      </div>
    </Link>
  )
}

export function FeaturedGrid() {
  return (
    <section className="relative border-t border-[hsl(var(--border))]/60 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <header className="mb-14 flex items-end justify-between gap-6">
          <div>
            <p className="text-eyebrow">The collection</p>
            <h2 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FRAGRANCES.map((f) => (
            <Card key={f.slug} f={f} />
          ))}
        </div>
      </div>
    </section>
  )
}
