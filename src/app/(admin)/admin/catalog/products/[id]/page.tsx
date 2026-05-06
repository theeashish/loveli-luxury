import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProductById, listCategories } from '@/lib/catalog/queries'
import { AdminProductForm } from '@/components/catalog/AdminProductForm'
import { AdminVariantsEditor } from '@/components/catalog/AdminVariantsEditor'
import { AdminImageUploader } from '@/components/catalog/AdminImageUploader'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit product' }

export default async function EditProductPage({
  params,
}: {
  params: { id: string }
}) {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const [product, categories] = await Promise.all([
    getProductById(id, { includeInactive: true }),
    listCategories({ includeInactive: true }),
  ])
  if (!product) notFound()

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/admin/catalog/products"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          /p/<span className="font-mono">{product.slug}</span>
        </p>
      </header>

      <div className="space-y-8">
        <section>
          <AdminProductForm mode={{ kind: 'edit', product }} categories={categories} />
        </section>

        <section>
          <AdminVariantsEditor productId={product.id} variants={product.variants} />
        </section>

        <section>
          <AdminImageUploader scope="product" parentId={product.id} images={product.images} />
        </section>
      </div>
    </div>
  )
}
