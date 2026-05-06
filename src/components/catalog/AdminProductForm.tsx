'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@/lib/catalog/schemas'
import { slugify } from '@/lib/catalog/slug'
import { createProduct, updateProduct, deleteProduct } from '@/lib/catalog/mutations'
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

  const initial: FormValues = mode.kind === 'create'
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Field
        label="Name"
        required
        error={form.formState.errors.name?.message}
        hint="The display name customers see on the product page."
      >
        <input
          type="text"
          {...form.register('name')}
          onBlur={(e) => {
            // Auto-fill slug on first blur if still empty.
            if (mode.kind === 'create' && !form.getValues('slug')) {
              form.setValue('slug', slugify(e.target.value))
            }
          }}
          className={inputCls}
          placeholder="Rose Noir"
        />
      </Field>

      <Field
        label="Slug"
        hint="URL path: /p/{slug}. Lowercase letters, digits, hyphens. Auto-derived from name if blank."
      >
        <input type="text" {...form.register('slug')} className={`${inputCls} font-mono`} placeholder="rose-noir" />
      </Field>

      <Field label="Description">
        <textarea
          {...form.register('description')}
          rows={5}
          className={inputCls}
          placeholder="Notes, story, occasion, longevity..."
        />
      </Field>

      <Field label="Category">
        <select {...form.register('categoryId')} className={inputCls}>
          <option value="">— uncategorised —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="rounded-lg border border-neutral-200 bg-white p-5">
        <legend className="px-1 text-sm font-medium text-neutral-700">SEO</legend>
        <div className="space-y-4 pt-2">
          <Field label="Meta title">
            <input type="text" {...form.register('metaTitle')} className={inputCls} maxLength={200} />
          </Field>
          <Field label="Meta description">
            <textarea {...form.register('metaDescription')} rows={3} className={inputCls} maxLength={500} />
          </Field>
        </div>
      </fieldset>

      <label className="flex items-center gap-3">
        <input type="checkbox" {...form.register('isActive')} className="h-4 w-4 rounded border-neutral-300" />
        <span className="text-sm text-neutral-700">Active — visible on the storefront</span>
      </label>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : mode.kind === 'create' ? 'Create product' : 'Save changes'}
        </button>
        {mode.kind === 'edit' && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isPending}
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Delete product
          </button>
        )}
      </div>
    </form>
  )
}

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      {hint && !error ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  )
}
