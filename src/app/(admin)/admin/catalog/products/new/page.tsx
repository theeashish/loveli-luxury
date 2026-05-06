import Link from 'next/link'
import { listCategories } from '@/lib/catalog/queries'
import { AdminProductForm } from '@/components/catalog/AdminProductForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New product' }

export default async function NewProductPage() {
  const categories = await listCategories({ includeInactive: true })

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <Link
          href="/admin/catalog/products"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create the product first, then add 30ml / 50ml / etc. variants on the next step.
        </p>
      </header>

      <AdminProductForm mode={{ kind: 'create' }} categories={categories} />
    </div>
  )
}
