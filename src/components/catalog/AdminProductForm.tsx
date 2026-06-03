'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/lib/toast'
import { z } from 'zod'

import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@/lib/catalog/schemas'
import { slugify } from '@/lib/catalog/slug'
import { createProduct, updateProduct, deleteProduct } from '@/lib/catalog/mutations'
import {
  AdminActionBar,
  AdminFormField,
  AdminFormSection,
  adminCheckboxCls,
  adminDangerBtnCls,
  adminInputCls,
  adminPrimaryBtnCls,
} from '@/components/admin/forms'
import type { CategoryDto, ProductDto } from '@/lib/catalog/types'

type Mode = { kind: 'create' } | { kind: 'edit'; product: ProductDto }

type FormValues = {
  slug: string
  name: string
  description: string
  categoryId: string
  isActive: boolean
  metaTitle: string
  metaDescription: string
}

const formSchema = z.object({
  slug: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  categoryId: z.string(),
  isActive: z.boolean(),
  metaTitle: z.string(),
  metaDescription: z.string(),
})

export function AdminProductForm({
  mode,
  categories,
}: {
  mode: Mode
  categories: CategoryDto[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const initial: FormValues =
    mode.kind === 'create'
      ? {
          slug: '',
          name: '',
          description: '',
          categoryId: '',
          isActive: true,
          metaTitle: '',
          metaDescription: '',
        }
      : {
          slug: mode.product.slug,
          name: mode.product.name,
          description: mode.product.description ?? '',
          categoryId: mode.product.categoryId?.toString() ?? '',
          isActive: mode.product.isActive,
          metaTitle: mode.product.metaTitle ?? '',
          metaDescription: mode.product.metaDescription ?? '',
        }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
  })

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    startTransition(async () => {
      try {
        if (mode.kind === 'create') {
          const payload: CreateProductInput = createProductSchema.parse({
            slug: values.slug || slugify(values.name),
            name: values.name,
            description: values.description.trim() || null,
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            isActive: values.isActive,
            metaTitle: values.metaTitle.trim() || null,
            metaDescription: values.metaDescription.trim() || null,
          })
          const result = await createProduct(payload)
          toast.success('Product created')
          router.push(`/admin/catalog/products/${result.id}`)
        } else {
          const payload: UpdateProductInput = updateProductSchema.parse({
            id: mode.product.id,
            slug: values.slug,
            name: values.name,
            description: values.description.trim() || null,
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            isActive: values.isActive,
            metaTitle: values.metaTitle.trim() || null,
            metaDescription: values.metaDescription.trim() || null,
          })
          await updateProduct(payload)
          toast.success('Product saved')
          router.refresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const onDelete = () => {
    if (mode.kind !== 'edit') return
    if (!confirm(`Delete "${mode.product.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        await deleteProduct(mode.product.id)
        toast.success('Product deleted')
        router.push('/admin/catalog/products')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <AdminFormSection
        title="Identity"
        subtitle="Name, URL slug, and product description for the storefront."
      >
        <AdminFormField
          label="Name"
          required
          error={form.formState.errors.name?.message}
          hint="The display name customers see on the product page."
        >
          <input
            type="text"
            {...form.register('name')}
            onBlur={(e) => {
              if (mode.kind === 'create' && !form.getValues('slug')) {
                form.setValue('slug', slugify(e.target.value))
              }
            }}
            className={adminInputCls}
            placeholder="Rose Noir"
          />
        </AdminFormField>

        <AdminFormField
          label="Slug"
          hint="URL path: /p/{slug}. Lowercase letters, digits, hyphens. Auto-derived from name if blank."
        >
          <input
            type="text"
            {...form.register('slug')}
            className={`${adminInputCls} font-mono`}
            placeholder="rose-noir"
          />
        </AdminFormField>

        <AdminFormField label="Description">
          <textarea
            {...form.register('description')}
            rows={5}
            className={adminInputCls}
            placeholder="Notes, story, occasion, longevity…"
          />
        </AdminFormField>

        <AdminFormField label="Category">
          <select {...form.register('categoryId')} className={adminInputCls}>
            <option value="">— uncategorised —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </AdminFormField>
      </AdminFormSection>

      <AdminFormSection
        title="SEO"
        subtitle="Meta title + description used by search engines and social cards."
      >
        <AdminFormField label="Meta title">
          <input
            type="text"
            {...form.register('metaTitle')}
            className={adminInputCls}
            maxLength={200}
          />
        </AdminFormField>
        <AdminFormField label="Meta description">
          <textarea
            {...form.register('metaDescription')}
            rows={3}
            className={adminInputCls}
            maxLength={500}
          />
        </AdminFormField>
      </AdminFormSection>

      <AdminFormSection title="Visibility">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            {...form.register('isActive')}
            className={adminCheckboxCls}
          />
          <span className="text-sm text-neutral-800">
            Active — visible on the storefront
          </span>
        </label>
      </AdminFormSection>

      <AdminActionBar
        cancelHref="/admin/catalog/products"
        secondary={
          mode.kind === 'edit' ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className={adminDangerBtnCls}
            >
              Delete product
            </button>
          ) : undefined
        }
        primary={
          <button
            type="submit"
            disabled={isPending}
            className={adminPrimaryBtnCls}
          >
            {isPending
              ? 'Saving…'
              : mode.kind === 'create'
                ? 'Create product'
                : 'Save changes'}
          </button>
        }
      />
    </form>
  )
}
