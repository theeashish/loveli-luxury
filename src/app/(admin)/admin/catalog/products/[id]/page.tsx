import { notFound } from 'next/navigation'
import { getProductById, listCategories } from '@/lib/catalog/queries'
import { AdminProductForm } from '@/components/catalog/AdminProductForm'
import { AdminVariantsEditor } from '@/components/catalog/AdminVariantsEditor'
import { AdminImageUploader } from '@/components/catalog/AdminImageUploader'
import { AdminPageHeader } from '@/components/admin/forms'

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
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="← Products"
        eyebrowHref="/admin/catalog/products"
        title={product.name}
        subtitle={`/p/${product.slug}`}
      />

      <div className="space-y-8">
        <AdminProductForm mode={{ kind: 'edit', product }} categories={categories} />
        <AdminVariantsEditor productId={product.id} variants={product.variants} />
        <AdminImageUploader scope="product" parentId={product.id} images={product.images} />
      </div>
    </div>
  )
}
