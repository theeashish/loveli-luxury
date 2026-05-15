/**
 * Commissions ledger view — paginated.
 *
 * Read-only. Phase 4 scope keeps it simple: 50 rows per page, walked via
 * `?page=`. No filters yet (level, period, paid/unpaid) — those are
 * trivial to add later if the surface gets noisy.
 */

import Link from 'next/link'
import { getCurrentDistributor } from '@/lib/distributors/current'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

type LedgerRow = {
  id: number
  level: number
  amount_minor: string
  rate_basis_points: number
  commission_basis_minor: string
  earned_at: string
  source_order_id: number
  payout_id: number | null
}

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const me = await getCurrentDistributor()
  if (!me) return null

  const page = Math.max(1, Number(searchParams.page ?? 1) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const service = createServiceClient()

  const [countRes, rowsRes, totalsRes] = await Promise.all([
    service
      .from('commission_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('distributor_id', me.id),
    service
      .from('commission_ledger')
      .select(
        'id, level, amount_minor, rate_basis_points, commission_basis_minor, earned_at, source_order_id, payout_id',
      )
      .eq('distributor_id', me.id)
      .order('earned_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
    service
      .from('commission_ledger')
      .select('amount_minor, payout_id')
      .eq('distributor_id', me.id),
  ])

  const total = countRes.count ?? 0
  const rows = (rowsRes.data ?? []) as LedgerRow[]
  const allRows = (totalsRes.data ?? []) as Array<{
    amount_minor: string
    payout_id: number | null
  }>
  const totalEarned = allRows.reduce((acc, r) => acc + BigInt(r.amount_minor), 0n)
  const totalUnpaid = allRows
    .filter((r) => r.payout_id === null)
    .reduce((acc, r) => acc + BigInt(r.amount_minor), 0n)
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Total earned" value={formatKes(totalEarned)} />
        <Stat label="Unpaid" value={formatKes(totalUnpaid)} sub="awaiting payout" />
        <Stat label="Entries" value={String(total)} />
      </section>

      <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
        <table className="min-w-full divide-y divide-[hsl(var(--border))] text-sm">
          <thead className="bg-[hsl(var(--background))]/40 text-left text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3">Earned</th>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3 text-right">Basis</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-[hsl(var(--muted-foreground))]"
                >
                  No commissions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(r.earned_at).toLocaleString('en-KE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">#{r.source_order_id}</td>
                  <td className="px-4 py-3">L{r.level}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatKes(BigInt(r.commission_basis_minor))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(r.rate_basis_points / 100).toFixed(r.rate_basis_points % 100 === 0 ? 0 : 1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatKes(BigInt(r.amount_minor))}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-[0.15em]">
                    {r.payout_id ? (
                      <span className="text-[hsl(var(--muted-foreground))]">
                        in payout #{r.payout_id}
                      </span>
                    ) : (
                      <span className="text-emerald-700">unpaid</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {lastPage > 1 ? (
        <nav className="flex items-center justify-between text-xs uppercase tracking-[0.15em]">
          {page > 1 ? (
            <Link
              href={`/account/distributor/commissions?page=${page - 1}`}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[hsl(var(--muted-foreground))]">
            Page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link
              href={`/account/distributor/commissions?page=${page + 1}`}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-light tabular-nums">{value}</p>
      {sub ? (
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>
      ) : null}
    </div>
  )
}
