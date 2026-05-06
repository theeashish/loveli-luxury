import Link from 'next/link'
import { listProductSummaries, listBundles } from '@/lib/catalog/queries'
import { ProductCard } from '@/components/catalog/ProductCard'
import { BundleHighlight } from '@/components/catalog/BundleHighlight'

export const revalidate = false

export default async function HomePage() {
  const [products, bundles] = await Promise.all([
    listProductSummaries(),
    listBundles(),
  ])

  // Showcase up to six products on the home page.
  const featured = products.slice(0, 6)
  const starterPacks = bundles.filter((b) => b.isStarterPackage).slice(0, 2)

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-[hsl(var(--border))]">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
            Loveli Luxury International
          </p>
          <h1 className="mx-auto max-w-3xl text-5xl font-light tracking-tight md:text-6xl">
            Where Love Meets Luxury
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[hsl(var(--muted-foreground))]">
            Hand-crafted Eau de Parfum, bottled with intention in Nairobi.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/shop"
              className="rounded-md bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))] transition hover:opacity-90"
            >
              Shop the collection
            </Link>
            <Link
              href="/bundles"
              className="rounded-md border border-[hsl(var(--border))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))]"
            >
              Discover bundles
            </Link>
          </div>
        </div>
      </section>

      {/* Featured products */}
      {featured.length > 0 ? (
        <section className="border-b border-[hsl(var(--border))]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <header className="mb-10 flex items-end justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                  Featured
                </p>
                <h2 className="mt-2 text-3xl font-light">From the collection</h2>
              </div>
              <Link
                href="/shop"
                className="text-sm uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
              >
                View all →
              </Link>
            </header>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Starter packs */}
      {starterPacks.length > 0 ? (
        <section>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <header className="mb-10 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                For distributors
              </p>
              <h2 className="mt-2 text-3xl font-light">Starter packages</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
                Begin your Loveli Luxury journey with a curated package and step into the
                7-level commission structure.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {starterPacks.map((b) => (
                <BundleHighlight key={b.id} bundle={b} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
