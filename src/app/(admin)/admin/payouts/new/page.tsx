/**
 * /admin/payouts/new — pick a distributor + period, optionally preview the
 * unpaid-earnings draft, then submit to create a `pending` payout row.
 *
 * Preview is rendered when the URL carries ?distributorId=&year=&month=. The
 * preview link is just a GET that round-trips through the same page; the
 * actual create is the bottom form which posts to the Server Action.
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { previewDraft } from '@/lib/payouts/draft'
import { formatKes } from '@/lib/money'
import { createPayoutDraft } from './actions'

export const dynamic = 'force-dynamic'

type SearchParams = {
  distributorId?: string
  year?: string
  month?: string
}

type DistRow = {
  id: number
  user_id: string
  sponsor_code: string
  payout_msisdn: string | null
}

type ProfileRow = {
  id: string
  email: string
  full_name: string
}

export default async function NewPayoutPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const distributorId = Number(searchParams.distributorId ?? '')
  const year = Number(searchParams.year ?? '')
  const month = Number(searchParams.month ?? '')

  const hasFilter =
    Number.isFinite(distributorId) &&
    distributorId > 0 &&
    Number.isFinite(year) &&
    year >= 2024 &&
    year <= 2099 &&
    Number.isFinite(month) &&
    month >= 1 &&
    month <= 12

  const service = createServiceClient()

  // Distributor list for the dropdown — small project, no pagination yet.
  const distRes = await service
    .from('distributors')
    .select('id, user_id, sponsor_code, payout_msisdn')
    .eq('is_active', true)
    .order('id')
    .limit(500)
  const distributors = (distRes.data ?? []) as DistRow[]

  const profilesRes = distributors.length
    ? await service
        .from('profiles')
        .select('id, email, full_name')
        .in(
          'id',
          distributors.map((d) => d.user_id),
        )
    : { data: [] as ProfileRow[] }
  const profiles = (profilesRes.data ?? []) as ProfileRow[]

  const distLabel = (d: DistRow) => {
    const p = profiles.find((x) => x.id === d.user_id)
    return p ? `${p.full_name} (${p.email})` : d.sponsor_code
  }

  const preview = hasFilter
    ? await previewDraft(distributorId, year, month).catch((err) => ({
        error: (err as Error).message,
      }))
    : null

  const previewOk =
    preview && !('error' in preview) ? preview : null
  const previewErr =
    preview && 'error' in preview ? (preview as { error: string }).error : null

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/payouts"
        className="text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900"
      >
        ← All payouts
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">New payout</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Aggregates unpaid commissions, salary, and rank-up bonuses for a single
        month into a draft. Initiate the M-Pesa transfer from the detail page.
      </p>

      {/* Preview form (GET) */}
      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <label className="flex flex-1 flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Distributor
          </span>
          <select
            name="distributorId"
            defaultValue={hasFilter ? distributorId : ''}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
            required
          >
            <option value="" disabled>
              Pick…
            </option>
            {distributors.map((d) => (
              <option key={d.id} value={d.id}>
                #{d.id} · {distLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Year
          </span>
          <input
            type="number"
            name="year"
            min={2024}
            max={2099}
            defaultValue={hasFilter ? year : new Date().getUTCFullYear()}
            className="w-24 rounded-md border border-neutral-300 bg-white px-3 py-2"
            required
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
            defaultValue={hasFilter ? month : new Date().getUTCMonth() + 1}
            className="w-20 rounded-md border border-neutral-300 bg-white px-3 py-2"
            required
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm"
        >
          Preview
        </button>
      </form>

      {previewErr ? (
        <p className="mt-6 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {previewErr}
        </p>
      ) : null}

      {previewOk ? (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Draft for #{previewOk.distributorId} ·{' '}
            {previewOk.periodYear}-{String(previewOk.periodMonth).padStart(2, '0')}
          </h2>

          {previewOk.items.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing unpaid for this distributor in this period.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-neutral-100 text-sm">
                {previewOk.items.map((it) => (
                  <li
                    key={`${it.type}-${it.id}`}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-neutral-700">{it.label}</span>
                    <span className="tabular-nums">
                      {formatKes(it.amount_minor)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-5 space-y-1 border-t border-neutral-200 pt-4 text-sm">
                <Row label="Commissions" value={formatKes(previewOk.commissionsTotalMinor)} />
                <Row label="Salary" value={formatKes(previewOk.salaryTotalMinor)} />
                <Row label="Rank-up bonuses" value={formatKes(previewOk.rankBonusTotalMinor)} />
                <Row label="Gross" value={formatKes(previewOk.grossTotalMinor)} bold />
                <Row label="Fees" value={formatKes(0n)} />
                <Row label="Net" value={formatKes(previewOk.netTotalMinor)} bold />
              </dl>

              <form action={createPayoutDraft} className="mt-6">
                <input type="hidden" name="distributorId" value={previewOk.distributorId} />
                <input type="hidden" name="periodYear" value={previewOk.periodYear} />
                <input type="hidden" name="periodMonth" value={previewOk.periodMonth} />
                <button
                  type="submit"
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
                >
                  Create draft
                </button>
              </form>
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bold ? 'text-base font-medium' : ''
      }`}
    >
      <span className={bold ? '' : 'text-neutral-500'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
