/**
 * /admin/orders — searchable, filterable list.
 *
 * Filters come in via query params so the admin can bookmark or share
 * specific views (e.g. all unpaid retail orders this week).
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'

const STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'fulfilled',
  'shipped',
  'delivered',
  'refunded',
] as const

const KINDS = ['retail', 'distributor_signup', 'distributor_restock'] as const

type SearchParams = {
  q?: string
  status?: string
  kind?: string
}

type OrderRow = {
  id: number
  order_number: string
  status: string
  kind: string
  customer_email: string
  total_minor: string
  created_at: string
  paid_at: string | null
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const q = (searchParams.q ?? '').trim()
  const status = STATUSES.find((s) => s === searchParams.status) ?? null
  const kind = KINDS.find((k) => k === searchParams.kind) ?? null

  const service = createServiceClient()
  let query = service
    .from('orders')
    .select(
      'id, order_number, status, kind, customer_email, total_minor, created_at, paid_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (kind) query = query.eq('kind', kind)
  if (q) {
    // Match either order_number or customer_email (case-insensitive on the
    // citext column).
    query = query.or(`order_number.ilike.%${q}%,customer_email.ilike.%${q}%`)
  }

  const r = await query
  const orders = (r.data ?? []) as OrderRow[]

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Most recent 200 matches.
          </p>
        </div>
      </header>

      <form className="mb-6 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Search
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Order number or email"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Status
          </span>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Kind
          </span>
          <select
            name="kind"
            defaultValue={kind ?? ''}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">Any</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Apply
        </button>
        {(q || status || kind) ? (
          <Link
            href="/admin/orders"
            className="text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900"
          >
            Reset
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                  No orders match.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-mono text-neutral-900 hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{o.customer_email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.15em] text-neutral-600">
                      {o.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatKes(BigInt(o.total_minor))}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(o.created_at).toLocaleString('en-KE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'paid' || status === 'fulfilled' || status === 'shipped' || status === 'delivered'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'pending'
        ? 'bg-amber-100 text-amber-800'
        : status === 'failed' || status === 'cancelled' || status === 'refunded'
          ? 'bg-rose-100 text-rose-800'
          : 'bg-neutral-100 text-neutral-700'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${tone}`}
    >
      {status}
    </span>
  )
}
