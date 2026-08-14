import { listCategories } from '@/lib/catalog/queries'
import { AdminProductForm } from '@/components/catalog/AdminProductForm'
import { AdminPageHeader } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add product' }

export default async function NewProductPage() {
  const categories = await listCategories({ includeInactive: true })

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="← Products"
        eyebrowHref="/admin/catalog/products"
        title="Add product"
        subtitle="Add the basic details first. You can add sizes and prices next."
      />
      <AdminProductForm mode={{ kind: 'create' }} categories={categories} />
    </div>
  )
}
