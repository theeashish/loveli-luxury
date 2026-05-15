import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'

type PayoutRow = {
  id: number
  distributor_id: number
  period_year: number
  period_month: number
  status: string
  gross_total_minor: string
  net_total_minor: string
  flutterwave_transfer_id: string | null
  created_at: string
  initiated_at: string | null
  completed_at: string | null
}

export default async function AdminPayoutsListPage() {
  const service = createServiceClient()
  const r = await service
    .from('payouts')
    .select(
      'id, distributor_id, period_year, period_month, status, gross_total_minor, net_total_minor, flutterwave_transfer_id, created_at, initiated_at, completed_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = (r.data ?? []) as PayoutRow[]

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Manual draft + initiate workflow. Auto monthly close lands in Phase 4.
          </p>
        </div>
        <Link
          href="/admin/payouts/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          New payout
        </Link>
      </header>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Distributor</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                  No payouts yet.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/payouts/${p.id}`}
                      className="font-mono text-neutral-900 hover:underline"
                    >
                      #{p.distributor_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.period_year}-{String(p.period_month).padStart(2, '0')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.15em]">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatKes(BigInt(p.gross_total_minor))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatKes(BigInt(p.net_total_minor))}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(p.created_at).toLocaleString('en-KE', {
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
