import Link from 'next/link'
import { listBundles } from '@/lib/catalog/queries'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bundles' }

export default async function BundlesListPage() {
  const bundles = await listBundles({ includeInactive: true })

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bundles</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {bundles.length} bundle{bundles.length === 1 ? '' : 's'} configured.
          </p>
        </div>
        <Link
          href="/admin/catalog/bundles/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New bundle
        </Link>
      </header>

      {bundles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No bundles yet. Click <strong>New bundle</strong> to create one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Retail</th>
                <th className="px-4 py-3 font-medium">À-la-carte</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bundles.map((b) => {
                const retail = BigInt(b.retailPriceMinor)
                const ala = BigInt(b.alaCarteTotalMinor)
                return (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{b.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-500">{b.slug}</td>
                    <td className="px-4 py-3 tabular-nums">{formatKes(retail)}</td>
                    <td className="px-4 py-3 tabular-nums text-neutral-500">{formatKes(ala)}</td>
                    <td className="px-4 py-3">
                      {b.isStarterPackage ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Starter {b.starterPackageCode ?? ''}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">Retail</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          b.isActive
                            ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                            : 'inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600'
                        }
                      >
                        {b.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/catalog/bundles/${b.id}`}
                        className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
