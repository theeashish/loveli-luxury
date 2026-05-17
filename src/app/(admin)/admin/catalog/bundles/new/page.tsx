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
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link
          href="/admin/catalog/bundles"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-neutral-500 transition hover:text-neutral-900"
        >
          ← Bundles
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
          New bundle
        </h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-600">
          Bundles power retail combos and the comp-plan starter packages.
          Define identity, pricing, and contents below.
        </p>
      </header>

      <AdminBundleForm mode={{ kind: 'create' }} products={products} initialItems={[]} />
    </div>
  )
}
