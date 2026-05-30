'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { slugify } from '@/lib/catalog/slug'
import { kesInputToMinor, minorToKesInput, isValidKesInput } from '@/lib/catalog/money-input'
import {
  createBundle,
  updateBundle,
  deleteBundle,
} from '@/lib/catalog/mutations'
import { formatKes } from '@/lib/money'
import {
  AdminActionBar,
  AdminFormField,
  AdminFormSection,
  adminCheckboxCls,
  adminDangerBtnCls,
  adminInputCls,
  adminPrimaryBtnCls,
} from '@/components/admin/forms'
import type { BundleDto, ProductDto } from '@/lib/catalog/types'

type Mode = { kind: 'create' } | { kind: 'edit'; bundle: BundleDto }

type FormValues = {
  slug: string
  name: string
  description: string
  retailKes: string
  distributorKes: string
  isStarterPackage: boolean
  starterPackageCode: string
  isActive: boolean
}

const formSchema = z
  .object({
    slug: z.string(),
    name: z.string().min(1, 'Name is required'),
    description: z.string(),
    retailKes: z.string().refine(isValidKesInput, 'Enter a price like 4000 or 4000.50'),
    distributorKes: z.string().refine(isValidKesInput, 'Enter a price like 4000 or 4000.50'),
    isStarterPackage: z.boolean(),
    starterPackageCode: z.string(),
    isActive: z.boolean(),
  })
  .refine((v) => !v.isStarterPackage || /^[A-Z]$/.test(v.starterPackageCode), {
    message: 'Starter packages need a single uppercase letter (A, B, …).',
    path: ['starterPackageCode'],
  })

type BundleItemDraft = { variantId: number; quantity: number }

export function AdminBundleForm({
  mode,
  products,
  initialItems,
}: {
  mode: Mode
  products: ProductDto[]
  initialItems: BundleItemDraft[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState<BundleItemDraft[]>(initialItems)

  const defaults: FormValues = mode.kind === 'create'
    ? {
        slug: '',
        name: '',
        description: '',
        retailKes: '',
        distributorKes: '',
        isStarterPackage: false,
        starterPackageCode: '',
        isActive: true,
      }
    : {
        slug: mode.bundle.slug,
        name: mode.bundle.name,
        description: mode.bundle.description ?? '',
        retailKes: minorToKesInput(String(mode.bundle.retailPriceMinor)),
        distributorKes: minorToKesInput(String(mode.bundle.distributorPriceMinor)),
        isStarterPackage: mode.bundle.isStarterPackage,
        starterPackageCode: mode.bundle.starterPackageCode ?? '',
        isActive: mode.bundle.isActive,
      }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  })

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    if (items.length === 0) {
      toast.error('Add at least one variant to the bundle')
      return
    }
    startTransition(async () => {
      try {
        if (mode.kind === 'create') {
          const result = await createBundle({
            slug: values.slug || slugify(values.name),
            name: values.name,
            description: values.description.trim() || null,
            retailPriceMinor: kesInputToMinor(values.retailKes),
            distributorPriceMinor: kesInputToMinor(values.distributorKes),
            currency: 'KES',
            isStarterPackage: values.isStarterPackage,
            starterPackageCode: values.starterPackageCode || null,
            isActive: values.isActive,
            items,
          })
          toast.success('Bundle created')
          router.push(`/admin/catalog/bundles/${result.id}`)
        } else {
          await updateBundle({
            id: mode.bundle.id,
            slug: values.slug,
            name: values.name,
            description: values.description.trim() || null,
            retailPriceMinor: kesInputToMinor(values.retailKes),
            distributorPriceMinor: kesInputToMinor(values.distributorKes),
            isStarterPackage: values.isStarterPackage,
            starterPackageCode: values.starterPackageCode || null,
            isActive: values.isActive,
            items,
          })
          toast.success('Bundle saved')
          router.refresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const onDelete = () => {
    if (mode.kind !== 'edit') return
    if (!confirm(`Delete "${mode.bundle.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        await deleteBundle(mode.bundle.id)
        toast.success('Bundle deleted')
        router.push('/admin/catalog/bundles')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  const isStarter = form.watch('isStarterPackage')

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <AdminFormSection
        title="Identity"
        subtitle="Name, URL slug and a description for the storefront."
      >
        <AdminFormField
          label="Name"
          required
          error={form.formState.errors.name?.message}
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
            placeholder="Discovery Trio"
          />
        </AdminFormField>

        <AdminFormField
          label="Slug"
          hint="URL path: /bundles/{slug}. Auto-derived from the name when blank."
        >
          <input
            type="text"
            {...form.register('slug')}
            className={`${adminInputCls} font-mono`}
          />
        </AdminFormField>

        <AdminFormField label="Description">
          <textarea
            {...form.register('description')}
            rows={4}
            className={adminInputCls}
            placeholder="Short pitch shown on the bundle detail page."
          />
        </AdminFormField>
      </AdminFormSection>

      <AdminFormSection
        title="Pricing"
        subtitle="Retail is what customers see; distributor price is the commission base."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AdminFormField
            label="Retail KES"
            required
            error={form.formState.errors.retailKes?.message}
            hint="What customers pay."
          >
            <input
              type="text"
              inputMode="decimal"
              {...form.register('retailKes')}
              className={adminInputCls}
              placeholder="4000"
            />
          </AdminFormField>
          <AdminFormField
            label="Distributor KES"
            required
            error={form.formState.errors.distributorKes?.message}
            hint="What distributors pay (commission base)."
          >
            <input
              type="text"
              inputMode="decimal"
              {...form.register('distributorKes')}
              className={adminInputCls}
              placeholder="2800"
            />
          </AdminFormField>
        </div>
      </AdminFormSection>

      <AdminFormSection
        title="Starter package"
        subtitle="Mark this bundle as a comp-plan onboarding kit."
      >
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            {...form.register('isStarterPackage')}
            className={adminCheckboxCls}
          />
          <span className="text-sm text-neutral-800">
            Use this bundle as a comp-plan starter package
          </span>
        </label>
        {isStarter ? (
          <div className="mt-4 max-w-[14rem]">
            <AdminFormField
              label="Starter package code"
              error={form.formState.errors.starterPackageCode?.message}
              hint="Single uppercase letter — A, B, …"
            >
              <input
                type="text"
                maxLength={1}
                {...form.register('starterPackageCode')}
                className={`${adminInputCls} w-20 text-center font-mono uppercase`}
              />
            </AdminFormField>
          </div>
        ) : null}
      </AdminFormSection>

      <AdminFormSection
        title="Contents"
        subtitle="Which product variants ship inside this bundle."
      >
        <BundleItemsEditor products={products} items={items} onChange={setItems} />
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
        cancelHref="/admin/catalog/bundles"
        secondary={
          mode.kind === 'edit' ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className={adminDangerBtnCls}
            >
              Delete bundle
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
                ? 'Create bundle'
                : 'Save changes'}
          </button>
        }
      />
    </form>
  )
}

function BundleItemsEditor({
  products,
  items,
  onChange,
}: {
  products: ProductDto[]
  items: BundleItemDraft[]
  onChange: (next: BundleItemDraft[]) => void
}) {
  const variantById = new Map<number, { product: ProductDto; sizeMl: number; retail: bigint }>()
  for (const p of products) {
    for (const v of p.variants) {
      if (!v.isActive) continue
      variantById.set(v.id, { product: p, sizeMl: v.sizeMl, retail: BigInt(v.retailPriceMinor) })
    }
  }

  const usedIds = new Set(items.map((i) => i.variantId))
  const available = Array.from(variantById.entries()).filter(([id]) => !usedIds.has(id))

  const [pickVariantId, setPickVariantId] = useState<string>('')
  const [pickQty, setPickQty] = useState<string>('1')

  const addItem = () => {
    const id = Number(pickVariantId)
    const qty = Number(pickQty)
    if (!Number.isInteger(id) || id <= 0) return
    if (!Number.isInteger(qty) || qty <= 0) return
    onChange([...items, { variantId: id, quantity: qty }])
    setPickVariantId('')
    setPickQty('1')
  }

  let alaCarte = 0n
  for (const it of items) {
    const v = variantById.get(it.variantId)
    if (v) alaCarte += v.retail * BigInt(it.quantity)
  }

  return (
    <div>
      <p className="text-xs text-neutral-500">
        À-la-carte total:{' '}
        <span className="font-medium tabular-nums text-neutral-800">
          {formatKes(alaCarte)}
        </span>
      </p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No variants in this bundle yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded border border-neutral-200">
          {items.map((it) => {
            const v = variantById.get(it.variantId)
            return (
              <li key={it.variantId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  {v ? `${v.product.name} — ${v.sizeMl}ml` : `Variant #${it.variantId}`}
                  <span className="ml-2 text-neutral-500">× {it.quantity}</span>
                </span>
                <input
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) => {
                    const next = items.map((x) =>
                      x.variantId === it.variantId
                        ? { ...x, quantity: Math.max(1, Number(e.target.value || '1')) }
                        : x,
                    )
                    onChange(next)
                  }}
                  className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => onChange(items.filter((x) => x.variantId !== it.variantId))}
                  className="text-xs text-red-700 hover:text-red-900"
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {available.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-500">All active variants are already in this bundle.</p>
      ) : (
        <div className="mt-3 flex items-end gap-2">
          <select
            value={pickVariantId}
            onChange={(e) => setPickVariantId(e.target.value)}
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">— pick a variant —</option>
            {available.map(([id, v]) => (
              <option key={id} value={id}>
                {v.product.name} — {v.sizeMl}ml ({formatKes(v.retail)})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={pickQty}
            onChange={(e) => setPickQty(e.target.value)}
            className="w-20 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!pickVariantId}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

// Field + inputCls moved to @/components/admin/forms for shared use
// across all admin forms.
