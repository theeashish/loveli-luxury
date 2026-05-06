'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  createVariant,
  updateVariant,
  deleteVariant,
} from '@/lib/catalog/mutations'
import { kesInputToMinor, minorToKesInput, isValidKesInput } from '@/lib/catalog/money-input'
import { formatKes } from '@/lib/money'
import type { VariantDto } from '@/lib/catalog/types'

type DraftVariant = {
  sku: string
  sizeMl: string
  retailKes: string
  distributorKes: string
  weightG: string
  inventoryQty: string
}

const EMPTY_DRAFT: DraftVariant = {
  sku: '',
  sizeMl: '',
  retailKes: '',
  distributorKes: '',
  weightG: '',
  inventoryQty: '0',
}

export function AdminVariantsEditor({
  productId,
  variants,
}: {
  productId: number
  variants: VariantDto[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState<DraftVariant>(EMPTY_DRAFT)

  const onAdd = () => {
    if (!draft.sku.trim() || !draft.sizeMl || !draft.retailKes || !draft.distributorKes) {
      toast.error('SKU, size, and both prices are required')
      return
    }
    if (!isValidKesInput(draft.retailKes) || !isValidKesInput(draft.distributorKes)) {
      toast.error('Prices must be numbers, e.g. 4000 or 4000.50')
      return
    }
    startTransition(async () => {
      try {
        await createVariant({
          productId,
          sku: draft.sku.trim(),
          sizeMl: Number(draft.sizeMl),
          retailPriceMinor: kesInputToMinor(draft.retailKes),
          distributorPriceMinor: kesInputToMinor(draft.distributorKes),
          weightG: draft.weightG ? Number(draft.weightG) : null,
          inventoryQty: Number(draft.inventoryQty || '0'),
          isActive: true,
        })
        setDraft(EMPTY_DRAFT)
        toast.success('Variant added')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Add failed')
      }
    })
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-medium">Variants</h2>
          <p className="text-sm text-neutral-500">One row per size — 30ml, 50ml, etc.</p>
        </div>
      </header>

      {variants.length === 0 ? (
        <p className="px-5 py-6 text-sm text-neutral-500">
          No variants yet. Add the first one below.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Size</th>
              <th className="px-4 py-2 font-medium">Retail</th>
              <th className="px-4 py-2 font-medium">Distributor</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {variants.map((v) => (
              <VariantRow key={v.id} variant={v} disabled={isPending} />
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t border-neutral-200 bg-neutral-50 p-5">
        <p className="mb-3 text-sm font-medium text-neutral-700">Add a variant</p>
        <div className="grid grid-cols-6 gap-3">
          <input
            placeholder="SKU"
            value={draft.sku}
            onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Size (ml)"
            type="number"
            value={draft.sizeMl}
            onChange={(e) => setDraft({ ...draft, sizeMl: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Retail KES"
            inputMode="decimal"
            value={draft.retailKes}
            onChange={(e) => setDraft({ ...draft, retailKes: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Distributor KES"
            inputMode="decimal"
            value={draft.distributorKes}
            onChange={(e) => setDraft({ ...draft, distributorKes: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Stock"
            type="number"
            value={draft.inventoryQty}
            onChange={(e) => setDraft({ ...draft, inventoryQty: e.target.value })}
            className={inputCls}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={isPending}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function VariantRow({ variant, disabled }: { variant: VariantDto; disabled: boolean }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    sku: variant.sku,
    sizeMl: String(variant.sizeMl),
    retailKes: minorToKesInput(variant.retailPriceMinor),
    distributorKes: minorToKesInput(variant.distributorPriceMinor),
    inventoryQty: String(variant.inventoryQty),
    isActive: variant.isActive,
  })

  const save = () => {
    startTransition(async () => {
      try {
        await updateVariant({
          id: variant.id,
          sku: draft.sku.trim(),
          sizeMl: Number(draft.sizeMl),
          retailPriceMinor: kesInputToMinor(draft.retailKes),
          distributorPriceMinor: kesInputToMinor(draft.distributorKes),
          inventoryQty: Number(draft.inventoryQty || '0'),
          isActive: draft.isActive,
        })
        toast.success('Variant saved')
        setEditing(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const remove = () => {
    if (!confirm(`Delete variant ${variant.sku}?`)) return
    startTransition(async () => {
      try {
        await deleteVariant(variant.id)
        toast.success('Variant deleted')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  if (!editing) {
    return (
      <tr className="hover:bg-neutral-50">
        <td className="px-4 py-3 font-mono text-xs">{variant.sku}</td>
        <td className="px-4 py-3 tabular-nums">{variant.sizeMl}ml</td>
        <td className="px-4 py-3 tabular-nums">{formatKes(BigInt(variant.retailPriceMinor))}</td>
        <td className="px-4 py-3 tabular-nums">{formatKes(BigInt(variant.distributorPriceMinor))}</td>
        <td className="px-4 py-3 tabular-nums">{variant.inventoryQty}</td>
        <td className="px-4 py-3">{variant.isActive ? 'Yes' : 'No'}</td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={disabled}
            className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={disabled}
            className="ml-3 text-sm font-medium text-red-700 hover:text-red-900"
          >
            Delete
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-amber-50/40">
      <td className="px-2 py-2"><input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} className={inputCls} /></td>
      <td className="px-2 py-2"><input type="number" value={draft.sizeMl} onChange={(e) => setDraft({ ...draft, sizeMl: e.target.value })} className={inputCls} /></td>
      <td className="px-2 py-2"><input value={draft.retailKes} onChange={(e) => setDraft({ ...draft, retailKes: e.target.value })} className={inputCls} /></td>
      <td className="px-2 py-2"><input value={draft.distributorKes} onChange={(e) => setDraft({ ...draft, distributorKes: e.target.value })} className={inputCls} /></td>
      <td className="px-2 py-2"><input type="number" value={draft.inventoryQty} onChange={(e) => setDraft({ ...draft, inventoryQty: e.target.value })} className={inputCls} /></td>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          className="h-4 w-4"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <button type="button" onClick={save} className="text-sm font-medium text-neutral-900">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="ml-3 text-sm text-neutral-500">Cancel</button>
      </td>
    </tr>
  )
}

const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
