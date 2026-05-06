import Link from 'next/link'
import { listProductSummaries, listBundles, listCategories } from '@/lib/catalog/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Catalog dashboard' }

export default async function CatalogDashboardPage() {
  const [products, bundles, categories] = await Promise.all([
    listProductSummaries({ includeInactive: true }),
    listBundles({ includeInactive: true }),
    listCategories({ includeInactive: true }),
  ])

  const stats = [
    { label: 'Products', value: products.length, href: '/admin/catalog/products' },
    { label: 'Bundles', value: bundles.length, href: '/admin/catalog/bundles' },
    { label: 'Categories', value: categories.length, href: '/admin/catalog/categories' },
  ]

  return (
    <div className="max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage perfumes, bundles, and the storefront category tree.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-neutral-200 bg-white p-6 transition hover:border-neutral-300 hover:shadow-sm"
          >
            <div className="text-3xl font-semibold tabular-nums">{s.value}</div>
            <div className="mt-1 text-sm text-neutral-500">{s.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
