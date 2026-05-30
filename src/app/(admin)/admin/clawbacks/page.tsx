/**
 * /admin/clawbacks — refunded orders whose commissions were already
 * paid out by the time the refund happened. Each row needs a human
 * decision (write off vs. deduct from a payout) so the books reflect
 * reality.
 *
 * Two sections:
 *   1. Pending — resolution IS NULL. Forms inline for per-row decision.
 *   2. Resolved — historical view, last 50.
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { resolveClawback } from './actions'

export const dynamic = 'force-dynamic'

type ResolutionRow = {
  id: number
  order_id: number
  paid_amount_minor: string | number
  paid_count: number
  resolution: string | null
  deducted_from_payout_id: number | null
  notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

type OrderRow = {
  id: number
  order_number: string
  customer_email: string
  total_minor: string | number
  paid_at: string | null
}

export default async function ClawbacksPage() {
  const service = createServiceClient()

  const [pendingRes, resolvedRes] = await Promise.all([
    service
      .from('clawback_resolutions')
      .select(
        'id, order_id, paid_amount_minor, paid_count, resolution, deducted_from_payout_id, notes, resolved_by, resolved_at, created_at',
      )
      .is('resolution', null)
      .order('created_at', { ascending: false })
      .limit(200),
    service
      .from('clawback_resolutions')
      .select(
        'id, order_id, paid_amount_minor, paid_count, resolution, deducted_from_payout_id, notes, resolved_by, resolved_at, created_at',
      )
      .not('resolution', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(50),
  ])

  const pending = (pendingRes.data ?? []) as ResolutionRow[]
  const resolved = (resolvedRes.data ?? []) as ResolutionRow[]

  const orderIds = Array.from(
    new Set([...pending, ...resolved].map((r) => r.order_id)),
  )
  const ordersRes = orderIds.length
    ? await service
        .from('orders')
        .select('id, order_number, customer_email, total_minor, paid_at')
        .in('id', orderIds)
    : { data: [] as OrderRow[] }
  const orders = (ordersRes.data ?? []) as OrderRow[]
  const orderById = (id: number) => orders.find((o) => o.id === id)

  const totalPendingMinor = pending.reduce(
    (acc, r) => acc + BigInt(r.paid_amount_minor),
    0n,
  )

  return (
    <div className="max-w-6xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Clawback resolutions
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Refunded orders whose commissions were already disbursed. Each
          one needs a decision so the books match reality.
        </p>
      </header>

      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Pending — {pending.length} ({formatKes(totalPendingMinor)})
          </h2>
        </header>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center text-sm text-neutral-500">
            No outstanding clawback decisions.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => {
              const o = orderById(row.order_id)
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-amber-300 bg-amber-50/40 p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm">
                        {o?.order_number ?? `#${row.order_id}`}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {o?.customer_email ?? '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.15em] text-neutral-500">
                        Paid commissions
                      </p>
                      <p className="font-medium tabular-nums">
                        {formatKes(BigInt(row.paid_amount_minor))} ·{' '}
                        {row.paid_count} row{row.paid_count === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <form action={resolveClawback} className="mt-4 grid gap-3 md:grid-cols-[1fr_8rem_8rem]">
                    <input type="hidden" name="resolutionId" value={row.id} />
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                        Notes (optional)
                      </span>
                      <input
                        type="text"
                        name="notes"
                        maxLength={2000}
                        placeholder="Reason / context"
                        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                        Payout id (if deducting)
                      </span>
                      <input
                        type="number"
                        name="deductedFromPayoutId"
                        min={1}
                        placeholder="—"
                        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="written_off"
                        className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-[0.15em] text-neutral-800 hover:bg-neutral-50"
                      >
                        Write off
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="deducted_from_payout"
                        className="flex-1 rounded-md bg-neutral-900 px-3 py-2 text-xs uppercase tracking-[0.15em] text-white"
                      >
                        Deducted
                      </button>
                    </div>
                  </form>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Resolved — last {Math.min(50, resolved.length)}
        </h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {resolved.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    No resolutions yet.
                  </td>
                </tr>
              ) : (
                resolved.map((row) => {
                  const o = orderById(row.order_id)
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs">
                        {o ? (
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="hover:underline"
                          >
                            {o.order_number}
                          </Link>
                        ) : (
                          `#${row.order_id}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs uppercase tracking-[0.15em]">
                        {row.resolution === 'written_off' ? (
                          <span className="text-rose-700">written off</span>
                        ) : (
                          <span className="text-emerald-700">
                            deducted
                            {row.deducted_from_payout_id
                              ? ` · payout #${row.deducted_from_payout_id}`
                              : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKes(BigInt(row.paid_amount_minor))}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-500">
                        {row.resolved_at
                          ? new Date(row.resolved_at).toLocaleString('en-KE', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                          : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
