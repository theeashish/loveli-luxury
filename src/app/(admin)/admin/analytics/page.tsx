/**
 * /admin/analytics — operational dashboard.
 *
 * Three sections, all simple aggregates straight off Postgres:
 *
 *   • Top earners (last 30 days) — sum of commission_ledger.amount_minor
 *     per distributor, sorted desc, top 20.
 *   • Distributor signups by month (last 12 months) — count of
 *     distributors.starter_paid_at falling in each month bucket.
 *   • Revenue by month (last 12 months) — sum of orders.total_minor on
 *     paid|fulfilled|shipped|delivered orders by month bucket.
 *
 * No Vega/recharts dep — bars are CSS-rendered. Phase 6 can promote to
 * a real chart lib if the dashboard sees heavy use.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'

type LedgerRow = { distributor_id: number; amount_minor: string; earned_at: string }
type DistRow = { id: number; user_id: string; sponsor_code: string }
type ProfileRow = { id: string; full_name: string }
type SignupRow = { starter_paid_at: string }
type OrderRow = { total_minor: string; paid_at: string }

const PAID_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'] as const

export default async function AdminAnalyticsPage() {
  const service = createServiceClient()
  const now = new Date()
  const since30 = new Date(now)
  since30.setUTCDate(since30.getUTCDate() - 30)
  const sinceYear = new Date(now)
  sinceYear.setUTCMonth(sinceYear.getUTCMonth() - 11)
  sinceYear.setUTCDate(1)
  sinceYear.setUTCHours(0, 0, 0, 0)

  const [ledgerRes, signupsRes, ordersRes] = await Promise.all([
    service
      .from('commission_ledger')
      .select('distributor_id, amount_minor, earned_at')
      .gte('earned_at', since30.toISOString()),
    service
      .from('distributors')
      .select('starter_paid_at')
      .gte('starter_paid_at', sinceYear.toISOString())
      .not('starter_paid_at', 'is', null),
    service
      .from('orders')
      .select('total_minor, paid_at')
      .in('status', PAID_STATUSES)
      .gte('paid_at', sinceYear.toISOString())
      .not('paid_at', 'is', null),
  ])

  const ledger = (ledgerRes.data ?? []) as LedgerRow[]
  const signups = (signupsRes.data ?? []) as SignupRow[]
  const orders = (ordersRes.data ?? []) as OrderRow[]

  // ----- Top earners -----
  const earnerTotals = new Map<number, bigint>()
  for (const l of ledger) {
    earnerTotals.set(
      l.distributor_id,
      (earnerTotals.get(l.distributor_id) ?? 0n) + BigInt(l.amount_minor),
    )
  }
  const topEarnerIds = Array.from(earnerTotals.entries())
    .sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0))
    .slice(0, 20)
    .map(([id]) => id)

  let earnerRows: Array<DistRow & { name: string; total: bigint }> = []
  if (topEarnerIds.length) {
    const distRes = await service
      .from('distributors')
      .select('id, user_id, sponsor_code')
      .in('id', topEarnerIds)
    const dists = (distRes.data ?? []) as DistRow[]
    const profilesRes = await service
      .from('profiles')
      .select('id, full_name')
      .in(
        'id',
        dists.map((d) => d.user_id),
      )
    const profiles = (profilesRes.data ?? []) as ProfileRow[]
    earnerRows = topEarnerIds
      .map((id) => {
        const d = dists.find((x) => x.id === id)
        if (!d) return null
        const p = profiles.find((x) => x.id === d.user_id)
        return {
          ...d,
          name: p?.full_name ?? d.sponsor_code,
          total: earnerTotals.get(id) ?? 0n,
        }
      })
      .filter((x): x is DistRow & { name: string; total: bigint } => x !== null)
  }

  const topTotal = earnerRows[0]?.total ?? 0n

  // ----- Signups by month -----
  const signupBuckets = monthBuckets(sinceYear, 12)
  for (const s of signups) {
    const key = ymKey(new Date(s.starter_paid_at))
    if (signupBuckets.has(key)) {
      signupBuckets.set(key, (signupBuckets.get(key) ?? 0) + 1)
    }
  }
  const signupSeries = Array.from(signupBuckets.entries())
  const signupMax = Math.max(1, ...signupSeries.map(([, v]) => v))

  // ----- Revenue by month -----
  const revenueBuckets = new Map<string, bigint>()
  for (const k of signupBuckets.keys()) revenueBuckets.set(k, 0n)
  for (const o of orders) {
    if (!o.paid_at) continue
    const key = ymKey(new Date(o.paid_at))
    if (revenueBuckets.has(key)) {
      revenueBuckets.set(
        key,
        (revenueBuckets.get(key) ?? 0n) + BigInt(o.total_minor),
      )
    }
  }
  const revenueSeries = Array.from(revenueBuckets.entries())
  const revenueMax = revenueSeries.reduce(
    (acc, [, v]) => (v > acc ? v : acc),
    0n,
  )

  return (
    <div className="max-w-6xl space-y-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Operational pulse. All figures in KES.
          </p>
        </div>
        <a
          href="/admin/analytics/cohorts"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-xs uppercase tracking-[0.15em] text-neutral-700 hover:bg-neutral-50"
        >
          Cohort analytics →
        </a>
      </header>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Top earners — last 30 days
        </h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Distributor</th>
                <th className="px-4 py-3">Sponsor code</th>
                <th className="px-4 py-3 text-right">Earnings</th>
                <th className="px-4 py-3">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {earnerRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                    No commission rows in the last 30 days.
                  </td>
                </tr>
              ) : (
                earnerRows.map((r, idx) => {
                  const ratio =
                    topTotal > 0n ? Number((r.total * 1000n) / topTotal) / 1000 : 0
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 tabular-nums text-neutral-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.sponsor_code}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKes(r.total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full bg-neutral-900"
                            style={{ width: `${Math.round(ratio * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          New distributors — last 12 months
        </h2>
        <BarSeries
          series={signupSeries}
          max={signupMax}
          format={(v) => String(v)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Revenue (paid orders) — last 12 months
        </h2>
        <BarSeries
          series={revenueSeries.map(([k, v]) => [k, Number(v / 100n)])}
          max={Number(revenueMax / 100n)}
          format={(v) =>
            new Intl.NumberFormat('en-KE', {
              style: 'currency',
              currency: 'KES',
              maximumFractionDigits: 0,
            }).format(v)
          }
        />
      </section>
    </div>
  )
}

function BarSeries({
  series,
  max,
  format,
}: {
  series: Array<[string, number]>
  max: number
  format: (v: number) => string
}) {
  const safeMax = max > 0 ? max : 1
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-12 items-end gap-2 h-40">
        {series.map(([key, value]) => {
          const pct = (value / safeMax) * 100
          return (
            <div key={key} className="flex flex-col items-center justify-end gap-1">
              <div
                title={`${key}: ${format(value)}`}
                className="w-full rounded-t bg-neutral-900"
                style={{ height: `${Math.max(2, pct)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-12 gap-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
        {series.map(([key]) => (
          <div key={key} className="text-center">
            {key.slice(2)}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-12 gap-2 text-xs tabular-nums">
        {series.map(([key, value]) => (
          <div key={key} className="text-center text-neutral-700">
            {format(value)}
          </div>
        ))}
      </div>
    </div>
  )
}

function monthBuckets(start: Date, count: number): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    )
    out.set(ymKey(d), 0)
  }
  return out
}

function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
