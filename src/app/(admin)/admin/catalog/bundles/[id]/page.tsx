import { notFound } from 'next/navigation'
import {
  getBundleById,
  getProductBySlug,
  listProductSummaries,
} from '@/lib/catalog/queries'
import { AdminBundleForm } from '@/components/catalog/AdminBundleForm'
import { AdminImageUploader } from '@/components/catalog/AdminImageUploader'
import { AdminPageHeader } from '@/components/admin/forms'
import type { ProductDto } from '@/lib/catalog/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit bundle' }

export default async function EditBundlePage({
  params,
}: {
  params: { id: string }
}) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const bundle = await getBundleById(id, { includeInactive: true })
  if (!bundle) notFound()

  const summaries = await listProductSummaries({ includeInactive: true })
  const products = (
    await Promise.all(
      summaries.map((s) => getProductBySlug(s.slug, { includeInactive: true })),
    )
  ).filter((p): p is ProductDto => p !== null)

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="← Bundles"
        eyebrowHref="/admin/catalog/bundles"
        title={bundle.name}
        subtitle={`/bundles/${bundle.slug}`}
      />

      <div className="space-y-8">
        <AdminBundleForm
          mode={{ kind: 'edit', bundle }}
          products={products}
          initialItems={bundle.items.map((it) => ({
            variantId: it.variantId,
            quantity: it.quantity,
          }))}
        />

        <AdminImageUploader scope="bundle" parentId={bundle.id} images={bundle.images} />
      </div>
    </div>
  )
}
