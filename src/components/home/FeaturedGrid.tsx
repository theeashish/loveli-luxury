import Image from 'next/image'
import Link from 'next/link'
import { FRAGRANCES, type FragranceMeta } from '@/lib/catalog/fragrance-meta'

const FEATURED_SLUGS = ['pink-allure', 'crimson-noir', 'afar'] as const

function Card({ f, index }: { f: FragranceMeta; index: number }) {
  const isDark = index === 1
  return (
    <Link
      href={'/p/' + f.slug}
      className={
        'loveli-reveal-up group relative min-h-[22rem] overflow-hidden border border-[hsl(35_45%_42%/0.24)] p-5 transition duration-300 hover:-translate-y-1 sm:min-h-[28rem] sm:p-7 ' +
        (isDark ? 'bg-[hsl(22_18%_10%)] text-[hsl(38_52%_87%)]' : 'bg-[hsl(38_42%_93%)] text-[hsl(22_18%_12%)]') +
        (index === 0 ? ' md:col-span-6' : ' md:col-span-3')
      }
    >
      <div className="loveli-sheen absolute inset-5 overflow-hidden bg-white/85 sm:inset-7">
        <Image
          src={f.image}
          alt={f.name}
          fill
          sizes="(max-width: 768px) 92vw, (max-width: 1280px) 46vw, 360px"
          quality={72}
          className="object-cover mix-blend-multiply transition duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <div className="relative z-10 flex min-h-[19rem] flex-col justify-between sm:min-h-[25rem]">
        <p className={'text-[9px] font-semibold uppercase tracking-[0.28em] ' + (isDark ? 'text-[hsl(35_58%_67%)]' : 'text-[hsl(35_45%_42%)]')}>
          {f.family}
        </p>
        <div className={'mt-auto max-w-[17rem] border-l pl-4 ' + (isDark ? 'border-[hsl(35_58%_67%/0.65)]' : 'border-[hsl(35_45%_42%/0.55)]')}>
          <h3 className="font-serif text-3xl leading-none tracking-tight sm:text-4xl">{f.name}</h3>
          <p className={'mt-2 text-sm italic ' + (isDark ? 'text-[hsl(38_52%_87%/0.78)]' : 'text-[hsl(22_12%_28%)]')}>{f.tagline}</p>
          <span className={'mt-4 inline-flex text-[9px] font-semibold uppercase tracking-[0.24em] underline-offset-4 group-hover:underline ' + (isDark ? 'text-[hsl(35_58%_67%)]' : 'text-[hsl(35_45%_42%)]')}>
            Discover the scent →
          </span>
        </div>
      </div>
    </Link>
  )
}

export function FeaturedGrid() {
  const featured = FEATURED_SLUGS.map((slug) => FRAGRANCES.find((f) => f.slug === slug)).filter(
    (f): f is FragranceMeta => Boolean(f),
  )

  return (
    <section className="relative border-b border-[hsl(35_45%_42%/0.24)] bg-[hsl(28_22%_18%)] py-7 sm:py-10">
      <div className="mx-auto max-w-7xl px-6">
        <header className="loveli-reveal-up mb-7 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[hsl(35_58%_67%)]">The Loveli edit</p>
            <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-[0.94] tracking-tight text-[hsl(38_52%_87%)] sm:text-5xl">
              Fragrance for the mood <em className="italic text-[hsl(35_58%_67%)]">you carry.</em>
            </h2>
          </div>
          <Link href="/shop" className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[hsl(35_58%_67%)] underline-offset-8 hover:underline">
            Shop all fragrances →
          </Link>
        </header>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {featured.map((f, index) => <Card key={f.slug} f={f} index={index} />)}
        </div>
      </div>
    </section>
  )
}
