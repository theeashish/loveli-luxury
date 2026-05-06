import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getBundleById,
  getProductBySlug,
  listProductSummaries,
} from '@/lib/catalog/queries'
import { AdminBundleForm } from '@/components/catalog/AdminBundleForm'
import { AdminImageUploader } from '@/components/catalog/AdminImageUploader'
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
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/admin/catalog/bundles"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Bundles
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{bundle.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          /bundles/<span className="font-mono">{bundle.slug}</span>
        </p>
      </header>

      <div className="space-y-8">
        <section>
          <AdminBundleForm
            mode={{ kind: 'edit', bundle }}
            products={products}
            initialItems={bundle.items.map((it) => ({
              variantId: it.variantId,
              quantity: it.quantity,
            }))}
          />
        </section>

        <section>
          <AdminImageUploader scope="bundle" parentId={bundle.id} images={bundle.images} />
        </section>
      </div>
    </div>
  )
}
