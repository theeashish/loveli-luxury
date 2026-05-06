import Link from 'next/link'
import { listProductSummaries } from '@/lib/catalog/queries'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Products' }

export default async function ProductsListPage() {
  const products = await listProductSummaries({ includeInactive: true })

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {products.length} product{products.length === 1 ? '' : 's'} in the catalog.
          </p>
        </div>
        <Link
          href="/admin/catalog/products/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New product
        </Link>
      </header>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No products yet. Click <strong>New product</strong> to start.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">From</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{p.slug}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {p.minRetailPriceMinor
                      ? formatKes(BigInt(p.minRetailPriceMinor))
                      : <span className="text-neutral-400">— no variants</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.isActive
                          ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : 'inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600'
                      }
                    >
                      {p.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/catalog/products/${p.id}`}
                      className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
