import { listProductSummaries, getProductBySlug } from '@/lib/catalog/queries'
import { AdminBundleForm } from '@/components/catalog/AdminBundleForm'
import { AdminPageHeader } from '@/components/admin/forms'
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
      <AdminPageHeader
        eyebrow="← Bundles"
        eyebrowHref="/admin/catalog/bundles"
        title="New bundle"
        subtitle="Bundles power retail combos and the comp-plan starter packages. Define identity, pricing, and contents below."
      />
      <AdminBundleForm mode={{ kind: 'create' }} products={products} initialItems={[]} />
    </div>
  )
}
