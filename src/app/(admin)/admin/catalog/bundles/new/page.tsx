import Link from 'next/link'
import { listProductSummaries, getProductBySlug } from '@/lib/catalog/queries'
import { AdminBundleForm } from '@/components/catalog/AdminBundleForm'
import type { ProductDto } from '@/lib/catalog/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New bundle' }

export default async function NewBundlePage() {
  // Need full ProductDto (with variants) for the picker. Hydrate via slug,
  // since it's the canonical full-fetch entry point.
  const summaries = await listProductSummaries({ includeInactive: true })
  const products = (
    await Promise.all(summaries.map((s) => getProductBySlug(s.slug, { includeInactive: true })))
  ).filter((p): p is ProductDto => p !== null)

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/admin/catalog/bundles"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Bundles
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New bundle</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Bundles power retail combos and the comp-plan starter packages.
        </p>
      </header>

      <AdminBundleForm mode={{ kind: 'create' }} products={products} initialItems={[]} />
    </div>
  )
}
