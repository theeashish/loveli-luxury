import { listCategories } from '@/lib/catalog/queries'
import { AdminProductForm } from '@/components/catalog/AdminProductForm'
import { AdminPageHeader } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New product' }

export default async function NewProductPage() {
  const categories = await listCategories({ includeInactive: true })

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="← Products"
        eyebrowHref="/admin/catalog/products"
        title="New product"
        subtitle="Create the product first, then add 30ml / 50ml / etc. variants on the next step."
      />
      <AdminProductForm mode={{ kind: 'create' }} categories={categories} />
    </div>
  )
}
