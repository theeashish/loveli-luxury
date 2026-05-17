'use client'

import Link from 'next/link'
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
        retailKes: minorToKesInput(mode.bundle.retailPriceMinor),
        distributorKes: minorToKesInput(mode.bundle.distributorPriceMinor),
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
      {/* IDENTITY */}
      <Section title="Identity" subtitle="Name, URL slug and a description for the storefront.">
        <Field label="Name" required error={form.formState.errors.name?.message}>
          <input
            type="text"
            {...form.register('name')}
            onBlur={(e) => {
              if (mode.kind === 'create' && !form.getValues('slug')) {
                form.setValue('slug', slugify(e.target.value))
              }
            }}
            className={inputCls}
            placeholder="Discovery Trio"
          />
        </Field>

        <Field
          label="Slug"
          hint="URL path: /bundles/{slug}. Auto-derived from the name when blank."
        >
          <input type="text" {...form.register('slug')} className={`${inputCls} font-mono`} />
        </Field>

        <Field label="Description">
          <textarea
            {...form.register('description')}
            rows={4}
            className={inputCls}
            placeholder="Short pitch shown on the bundle detail page."
          />
        </Field>
      </Section>

      {/* PRICING */}
      <Section title="Pricing" subtitle="Retail is what customers see; distributor price is the commission base.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Retail KES"
            required
            error={form.formState.errors.retailKes?.message}
            hint="What customers pay."
          >
            <input
              type="text"
              inputMode="decimal"
              {...form.register('retailKes')}
              className={inputCls}
              placeholder="4000"
            />
          </Field>
          <Field
            label="Distributor KES"
            required
            error={form.formState.errors.distributorKes?.message}
            hint="What distributors pay (commission base)."
          >
            <input
              type="text"
              inputMode="decimal"
              {...form.register('distributorKes')}
              className={inputCls}
              placeholder="2800"
            />
          </Field>
        </div>
      </Section>

      {/* STARTER PACKAGE */}
      <Section title="Starter package" subtitle="Mark this bundle as a comp-plan onboarding kit.">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            {...form.register('isStarterPackage')}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
          />
          <span className="text-sm text-neutral-700">
            Use this bundle as a comp-plan starter package
          </span>
        </label>
        {isStarter ? (
          <div className="mt-4 max-w-[14rem]">
            <Field
              label="Starter package code"
              error={form.formState.errors.starterPackageCode?.message}
              hint="Single uppercase letter — A, B, …"
            >
              <input
                type="text"
                maxLength={1}
                {...form.register('starterPackageCode')}
                className={`${inputCls} w-20 text-center font-mono uppercase`}
              />
            </Field>
          </div>
        ) : null}
      </Section>

      {/* CONTENTS */}
      <Section title="Contents" subtitle="Which product variants ship inside this bundle.">
        <BundleItemsEditor products={products} items={items} onChange={setItems} />
      </Section>

      {/* VISIBILITY */}
      <Section title="Visibility">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            {...form.register('isActive')}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
          />
          <span className="text-sm text-neutral-700">Active — visible on the storefront</span>
        </label>
      </Section>

      {/* ACTION BAR */}
      <div className="sticky bottom-0 -mx-1 mt-8 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm">
        <Link
          href="/admin/catalog/bundles"
          className="text-sm text-neutral-500 transition hover:text-neutral-900"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-3">
          {mode.kind === 'edit' ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending}
              className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              Delete bundle
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-neutral-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60"
          >
            {isPending ? 'Saving…' : mode.kind === 'create' ? 'Create bundle' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * Section — a labelled card containing one group of form fields.
 * Gives each chunk of the form a clear visual envelope so the page
 * stops feeling like a wall of inputs.
 */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
      <div className="mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
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
    <fieldset className="rounded-lg border border-neutral-200 bg-white p-5">
      <legend className="px-1 text-sm font-medium text-neutral-700">Contents</legend>
      <p className="mt-1 text-xs text-neutral-500">
        À-la-carte total: <span className="font-medium tabular-nums">{formatKes(alaCarte)}</span>
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
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}
    </fieldset>
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
