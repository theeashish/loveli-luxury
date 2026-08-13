import { listProductSummaries } from '@/lib/catalog/queries'
import { ProductCard } from '@/components/catalog/ProductCard'
import { EditorialPageHeader } from '@/components/editorial/EditorialPageHeader'
import { getSection } from '@/lib/content/site'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'The Collection | Loveli Luxury Scents',
  description: 'Discover the Loveli Luxury Eau de Parfum collection.',
  alternates: { canonical: '/shop' },
}

export default async function ShopPage() {
  const [products, content] = await Promise.all([
    listProductSummaries(),
    getSection('shop_landing'),
  ])
  const countLine =
    products.length === 0
      ? content.emptyMessage
      : `${products.length} ${products.length === 1 ? content.countSingular : content.countPlural}`

  return (
    <div>
      <EditorialPageHeader
        eyebrow={content.eyebrow}
        title={content.headline}
        description={content.subhead}
        detail={countLine}
      />

      <section className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="border-y border-[hsl(var(--border))] py-16 text-center">
            <p className="font-serif text-3xl italic text-[hsl(var(--foreground))]">{content.emptyMessage}</p>
          </div>
        )}
      </section>
    </div>
  )
}
