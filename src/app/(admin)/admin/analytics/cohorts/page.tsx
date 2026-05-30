/**
 * /admin/analytics/cohorts — deeper cohort analysis.
 *
 * Three views, all bucketed by calendar month and computed in JS off
 * straight aggregate queries:
 *
 *   1. Retention — distributors grouped by signup month. For each
 *      subsequent month, % who logged a paid order or earned any
 *      commission that month. Classic cohort grid.
 *
 *   2. ARPU per cohort — total commissionable revenue attributable to
 *      a cohort over its entire lifetime ÷ cohort size.
 *
 *   3. GSV vs commission paid — monthly snapshot of total
 *      commissionable basis (commissionable_amount_minor on paid
 *      orders) vs total commissions written (commission_ledger.
 *      amount_minor) for that month. The ratio should track around 40%
 *      under the comp plan; persistent spikes outside that range flag
 *      misconfiguration or compression edge cases.
 *
 * Scope is "last 12 months". Pre-launch this is essentially empty;
 * the view is designed to be useful day 1 of real traffic.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'

const PAID_STATUSES = ['paid', 'fulfilled', 'shipped', 'delivered'] as const

type DistRow = { id: number; starter_paid_at: string }
type LedgerRow = {
  distributor_id: number
  amount_minor: string | number
  commission_basis_minor: string | number
  earned_at: string
}

function ymKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function* monthRange(start: Date, count: number): Generator<string> {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  for (let i = 0; i < count; i++) {
    yield ymKey(d)
    d.setUTCMonth(d.getUTCMonth() + 1)
  }
}

export default async function CohortsPage() {
  const service = createServiceClient()
  const now = new Date()
  const sinceYear = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))

  const [distRes, ordersRes, ledgerRes, itemsAggRes] = await Promise.all([
    service
      .from('distributors')
      .select('id, starter_paid_at')
      .gte('starter_paid_at', sinceYear.toISOString())
      .not('starter_paid_at', 'is', null),
    service
      .from('orders')
      .select('id, sponsor_distributor_id, total_minor, paid_at')
      .in('status', PAID_STATUSES)
      .gte('paid_at', sinceYear.toISOString())
      .not('paid_at', 'is', null),
    service
      .from('commission_ledger')
      .select('distributor_id, amount_minor, commission_basis_minor, earned_at')
      .gte('earned_at', sinceYear.toISOString()),
    service
      .from('order_items')
      .select('order_id, commissionable_amount_minor'),
  ])

  const distributors = (distRes.data ?? []) as DistRow[]
  const orders = (ordersRes.data ?? []) as Array<{
    id: number
    sponsor_distributor_id: number | null
    total_minor: string | number
    paid_at: string
  }>
  const ledger = (ledgerRes.data ?? []) as LedgerRow[]
  const items = (itemsAggRes.data ?? []) as Array<{
    order_id: number
    commissionable_amount_minor: string | number
  }>

  // Cohort assignment: signup month -> distributor ids
  const cohortToIds = new Map<string, number[]>()
  const distToCohort = new Map<number, string>()
  for (const d of distributors) {
    if (!d.starter_paid_at) continue
    const key = ymKey(new Date(d.starter_paid_at))
    distToCohort.set(d.id, key)
    const arr = cohortToIds.get(key) ?? []
    arr.push(d.id)
    cohortToIds.set(key, arr)
  }
  const cohorts = Array.from(cohortToIds.keys()).sort()
  const months = Array.from(monthRange(sinceYear, 12))

  // Build retention grid:
  //   active(cohort, month) = distributors in cohort who had any commission
  //   row OR sponsored any paid order in that month.
  // We use sponsor_distributor_id on orders + distributor_id on
  // commission_ledger as the activity signal.
  const activityByMonth = new Map<string, Set<number>>()
  for (const o of orders) {
    if (!o.sponsor_distributor_id) continue
    const key = ymKey(new Date(o.paid_at))
    const set = activityByMonth.get(key) ?? new Set<number>()
    set.add(o.sponsor_distributor_id)
    activityByMonth.set(key, set)
  }
  for (const l of ledger) {
    const key = ymKey(new Date(l.earned_at))
    const set = activityByMonth.get(key) ?? new Set<number>()
    set.add(l.distributor_id)
    activityByMonth.set(key, set)
  }

  // Order id → total commissionable amount (sum of order_items)
  const commissionableByOrder = new Map<number, bigint>()
  for (const it of items) {
    commissionableByOrder.set(
      it.order_id,
      (commissionableByOrder.get(it.order_id) ?? 0n) +
        BigInt(it.commissionable_amount_minor),
    )
  }

  // ARPU per cohort = total revenue from orders sponsored by cohort members /
  // cohort size. Use orders.total_minor (gross customer payment).
  const revenueByCohort = new Map<string, bigint>()
  for (const o of orders) {
    if (!o.sponsor_distributor_id) continue
    const cohort = distToCohort.get(o.sponsor_distributor_id)
    if (!cohort) continue
    revenueByCohort.set(
      cohort,
      (revenueByCohort.get(cohort) ?? 0n) + BigInt(o.total_minor),
    )
  }

  // GSV vs commission paid by month.
  const gsvByMonth = new Map<string, bigint>()
  const commPaidByMonth = new Map<string, bigint>()
  for (const m of months) {
    gsvByMonth.set(m, 0n)
    commPaidByMonth.set(m, 0n)
  }
  for (const o of orders) {
    const key = ymKey(new Date(o.paid_at))
    if (!gsvByMonth.has(key)) continue
    const basis = commissionableByOrder.get(o.id) ?? 0n
    gsvByMonth.set(key, (gsvByMonth.get(key) ?? 0n) + basis)
  }
  for (const l of ledger) {
    const key = ymKey(new Date(l.earned_at))
    if (!commPaidByMonth.has(key)) continue
    commPaidByMonth.set(
      key,
      (commPaidByMonth.get(key) ?? 0n) + BigInt(l.amount_minor),
    )
  }

  return (
    <div className="max-w-6xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cohort analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Retention, ARPU, and GSV-vs-payout health for the last 12 months.
        </p>
      </header>

      {/* ── Retention ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Retention — % of cohort active by month
        </h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-xs">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-neutral-500">
                  Cohort
                </th>
                <th className="px-3 py-2 text-right font-medium text-neutral-500">
                  Size
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-2 text-right font-mono font-normal text-neutral-500"
                  >
                    {m.slice(2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cohorts.length === 0 ? (
                <tr>
                  <td colSpan={2 + months.length} className="px-3 py-8 text-center text-neutral-500">
                    No cohorts yet.
                  </td>
                </tr>
              ) : (
                cohorts.map((cohort) => {
                  const ids = cohortToIds.get(cohort) ?? []
                  return (
                    <tr key={cohort}>
                      <td className="px-3 py-2 font-mono">{cohort}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{ids.length}</td>
                      {months.map((m) => {
                        // Only meaningful for months >= cohort
                        if (m < cohort) {
                          return <td key={m} className="px-2 py-2 text-right text-neutral-300">·</td>
                        }
                        const active = activityByMonth.get(m) ?? new Set<number>()
                        const hit = ids.filter((id) => active.has(id)).length
                        const pct = ids.length ? Math.round((hit / ids.length) * 100) : 0
                        return (
                          <td
                            key={m}
                            className={`px-2 py-2 text-right font-mono tabular-nums ${
                              pct >= 60
                                ? 'bg-emerald-50 text-emerald-800'
                                : pct >= 30
                                  ? 'bg-amber-50 text-amber-800'
                                  : pct > 0
                                    ? 'bg-rose-50 text-rose-800'
                                    : 'text-neutral-400'
                            }`}
                          >
                            {pct}%
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── ARPU per cohort ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          ARPU — total revenue ÷ cohort size, lifetime
        </h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
              <tr>
                <th className="px-4 py-3">Cohort</th>
                <th className="px-4 py-3 text-right">Size</th>
                <th className="px-4 py-3 text-right">Lifetime revenue</th>
                <th className="px-4 py-3 text-right">ARPU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {cohorts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    No cohorts yet.
                  </td>
                </tr>
              ) : (
                cohorts.map((cohort) => {
                  const size = cohortToIds.get(cohort)?.length ?? 0
                  const revenue = revenueByCohort.get(cohort) ?? 0n
                  const arpuMinor = size > 0 ? revenue / BigInt(size) : 0n
                  return (
                    <tr key={cohort}>
                      <td className="px-4 py-3 font-mono">{cohort}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{size}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatKes(revenue)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatKes(arpuMinor)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── GSV vs commission paid ────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          GSV vs commission paid — should track ≈ 40%
        </h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">GSV (commissionable)</th>
                <th className="px-4 py-3 text-right">Commissions paid</th>
                <th className="px-4 py-3 text-right">Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {months.map((m) => {
                const gsv = gsvByMonth.get(m) ?? 0n
                const paid = commPaidByMonth.get(m) ?? 0n
                const ratio =
                  gsv > 0n ? Number((paid * 10000n) / gsv) / 100 : 0
                const tone =
                  gsv === 0n
                    ? 'text-neutral-400'
                    : ratio > 45
                      ? 'bg-rose-50 text-rose-800'
                      : ratio < 30 && ratio > 0
                        ? 'bg-amber-50 text-amber-800'
                        : ratio > 0
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'text-neutral-400'
                return (
                  <tr key={m}>
                    <td className="px-4 py-3 font-mono">{m}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatKes(gsv)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatKes(paid)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono tabular-nums ${tone}`}>
                      {gsv > 0n ? `${ratio.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
