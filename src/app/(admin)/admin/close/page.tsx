/**
 * /admin/close — manual monthly close + auto-drafted payouts.
 *
 * Two forms, same period inputs:
 *   1. Run close: iterates active distributors and computes GSV / salary /
 *      rank-ups for the chosen month.
 *   2. Draft payouts: turns each distributor's unpaid earnings for the
 *      month into a `pending` payouts row.
 *
 * Result summaries surface via redirect query params after each action.
 * Below the forms we render the latest GSV snapshots for the chosen period
 * so the admin can eyeball the results before drafting payouts.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { runMonthlyClose, draftPayoutsForPeriodAction } from './actions'

export const dynamic = 'force-dynamic'

type SearchParams = {
  year?: string
  month?: string
  ran?: string
  processed?: string
  failed?: string
  promoted?: string
  drafted?: string
  created?: string
  existed?: string
  zero?: string
}

type SnapshotRow = {
  distributor_id: number
  personal_bottles_sold: number
  personal_sales_minor: string | number
  team_gsv_minor: string | number
  active_recruits_count: number
  computed_at: string
}

type SalaryRow = {
  distributor_id: number
  qualified: boolean
  fixed_salary_minor: string | number
  performance_bonus_minor: string | number
  total_minor: string | number
  payout_id: number | null
}

type DistRow = {
  id: number
  user_id: string
  sponsor_code: string
}

type ProfileRow = {
  id: string
  full_name: string
}

const now = new Date()

export default async function AdminClosePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const year = Number(searchParams.year ?? now.getUTCFullYear())
  const month = Number(searchParams.month ?? now.getUTCMonth() + 1)
  const validPeriod =
    Number.isFinite(year) &&
    year >= 2024 &&
    year <= 2099 &&
    Number.isFinite(month) &&
    month >= 1 &&
    month <= 12

  const service = createServiceClient()

  // Snapshots + salaries for the displayed period
  let snapshots: SnapshotRow[] = []
  let salaries: SalaryRow[] = []
  let distributors: DistRow[] = []
  let profiles: ProfileRow[] = []
  if (validPeriod) {
    const [snapRes, salRes, distRes] = await Promise.all([
      service
        .from('gsv_snapshots')
        .select(
          'distributor_id, personal_bottles_sold, personal_sales_minor, team_gsv_minor, active_recruits_count, computed_at',
        )
        .eq('period_year', year)
        .eq('period_month', month)
        .order('team_gsv_minor', { ascending: false }),
      service
        .from('monthly_salaries')
        .select(
          'distributor_id, qualified, fixed_salary_minor, performance_bonus_minor, total_minor, payout_id',
        )
        .eq('period_year', year)
        .eq('period_month', month),
      service
        .from('distributors')
        .select('id, user_id, sponsor_code')
        .eq('is_active', true),
    ])
    snapshots = (snapRes.data ?? []) as SnapshotRow[]
    salaries = (salRes.data ?? []) as SalaryRow[]
    distributors = (distRes.data ?? []) as DistRow[]
    if (distributors.length) {
      const pr = await service
        .from('profiles')
        .select('id, full_name')
        .in(
          'id',
          distributors.map((d) => d.user_id),
        )
      profiles = (pr.data ?? []) as ProfileRow[]
    }
  }

  const distLabel = (distributorId: number): string => {
    const d = distributors.find((x) => x.id === distributorId)
    if (!d) return `#${distributorId}`
    const p = profiles.find((x) => x.id === d.user_id)
    return p
      ? `#${distributorId} · ${p.full_name}`
      : `#${distributorId} · ${d.sponsor_code}`
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Monthly close</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Compute GSV, salaries, and rank-ups for a calendar month, then auto-draft payouts.
        </p>
      </header>

      {/* Summary banners after action redirects */}
      {searchParams.ran ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Close ran for <strong>{searchParams.ran}</strong>: processed{' '}
          {searchParams.processed ?? '0'}, promoted {searchParams.promoted ?? '0'},
          failed {searchParams.failed ?? '0'}.
        </div>
      ) : null}
      {searchParams.drafted ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Drafted payouts for <strong>{searchParams.drafted}</strong>:{' '}
          {searchParams.created ?? '0'} created,{' '}
          {searchParams.existed ?? '0'} already existed,{' '}
          {searchParams.zero ?? '0'} had zero earnings,{' '}
          {searchParams.failed ?? '0'} failed.
        </div>
      ) : null}

      {/* Period picker (GET) */}
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Year
          </span>
          <input
            type="number"
            name="year"
            min={2024}
            max={2099}
            defaultValue={year}
            className="w-24 rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Month
          </span>
          <input
            type="number"
            name="month"
            min={1}
            max={12}
            defaultValue={month}
            className="w-20 rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2"
        >
          View period
        </button>
      </form>

      {/* Action buttons (POST) */}
      <div className="mb-8 flex flex-wrap gap-3">
        <form action={runMonthlyClose}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Run close for {year}-{String(month).padStart(2, '0')}
          </button>
        </form>
        <form action={draftPayoutsForPeriodAction}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm"
          >
            Draft payouts for {year}-{String(month).padStart(2, '0')}
          </button>
        </form>
      </div>

      {/* Snapshot table */}
      <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
        GSV snapshots — {year}-{String(month).padStart(2, '0')}
      </h2>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Distributor</th>
              <th className="px-4 py-3 text-right">Bottles</th>
              <th className="px-4 py-3 text-right">Personal sales</th>
              <th className="px-4 py-3 text-right">Team GSV</th>
              <th className="px-4 py-3 text-right">Active recruits</th>
              <th className="px-4 py-3 text-right">Salary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {snapshots.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                  No snapshots for this period yet. Run close to populate.
                </td>
              </tr>
            ) : (
              snapshots.map((s) => {
                const sal = salaries.find((x) => x.distributor_id === s.distributor_id)
                return (
                  <tr key={s.distributor_id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">{distLabel(s.distributor_id)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.personal_bottles_sold}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatKes(BigInt(s.personal_sales_minor))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatKes(BigInt(s.team_gsv_minor))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.active_recruits_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {sal ? (
                        <span
                          className={
                            sal.qualified ? 'text-emerald-700' : 'text-neutral-400'
                          }
                        >
                          {formatKes(BigInt(sal.total_minor))}
                          {sal.payout_id ? ' ·🔒' : ''}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
