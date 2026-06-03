import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { BulkFireButton } from './BulkFireButton'

export const dynamic = 'force-dynamic'

type PayoutRow = {
  id: number
  distributor_id: number
  period_year: number
  period_month: number
  status: string
  gross_total_minor: string | number
  net_total_minor: string | number
  /**
   * IntaSend batch tracking id (from migration 047). Historical PayHero
   * payouts still carry the value in `payhero_transfer_reference` —
   * both columns are surfaced on the detail page.
   */
  tracking_id: string | null
  created_at: string
  initiated_at: string | null
  completed_at: string | null
}

export default async function AdminPayoutsListPage() {
  const service = createServiceClient()
  // `tracking_id` is added by migration 047 (Phase 0 of the PayHero →
  // IntaSend cutover). The generated `database.ts` types are stale until
  // someone runs `npm run supabase:types` against the migrated project,
  // so we cast through `unknown` here. Remove the cast once the types
  // are regenerated.
  const r = (await (service.from('payouts') as unknown as {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => Promise<{
          data: PayoutRow[] | null
          error: { message: string } | null
        }>
      }
    }
  })
    .select(
      'id, distributor_id, period_year, period_month, status, gross_total_minor, net_total_minor, tracking_id, created_at, initiated_at, completed_at',
    )
    .order('created_at', { ascending: false })
    .limit(200))
  const rows = (r.data ?? []) as PayoutRow[]
  const pendingCount = rows.filter((p) => p.status === 'pending').length

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Monthly cron drafts payouts; admin reviews and fires them. Use the
            bulk-fire button below to process every eligible pending payout in
            one click, or click into a row to fire individually.
          </p>
        </div>
        <Link
          href="/admin/payouts/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          New payout
        </Link>
      </header>

      <div className="mb-6">
        <BulkFireButton pendingCount={pendingCount} />
      </div>

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
