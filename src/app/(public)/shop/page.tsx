import { listProductSummaries } from '@/lib/catalog/queries'
import { ProductCard } from '@/components/catalog/ProductCard'

export const revalidate = false
export const metadata = {
  title: 'Shop',
  description: 'The full Loveli Luxury Eau de Parfum collection.',
}

export default async function ShopPage() {
  const products = await listProductSummaries()

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Shop</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">The collection</h1>
        <p className="mt-4 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
          {products.length === 0
            ? 'New arrivals soon. Check back shortly.'
            : `${products.length} fragrance${products.length === 1 ? '' : 's'} available.`}
        </p>
      </header>

      {products.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
