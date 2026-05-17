/**
 * /admin/payouts/new — pick a distributor + period, optionally preview the
 * unpaid-earnings draft, then submit to create a `pending` payout row.
 *
 * Preview is rendered when the URL carries ?distributorId=&year=&month=. The
 * preview link is just a GET that round-trips through the same page; the
 * actual create is the bottom form which posts to the Server Action.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { previewDraft } from '@/lib/payouts/draft'
import { formatKes } from '@/lib/money'
import {
  AdminPageHeader,
  AdminFormSection,
  adminInputCls,
  adminPrimaryBtnCls,
  adminSecondaryBtnCls,
} from '@/components/admin/forms'
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
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="← All payouts"
        eyebrowHref="/admin/payouts"
        title="New payout"
        subtitle="Aggregates unpaid commissions, salary, and rank-up bonuses for a single month into a draft. Initiate the M-Pesa transfer from the detail page."
      />

      <div className="space-y-5">
        <AdminFormSection
          title="Preview unpaid earnings"
          subtitle="Pick a distributor and period; we show what would be paid before you commit."
        >
          <form className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-1 min-w-[14rem] flex-col">
              <span className="mb-1.5 text-sm font-medium text-neutral-800">
                Distributor
              </span>
              <select
                name="distributorId"
                defaultValue={hasFilter ? distributorId : ''}
                className={adminInputCls}
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
              <span className="mb-1.5 text-sm font-medium text-neutral-800">
                Year
              </span>
              <input
                type="number"
                name="year"
                min={2024}
                max={2099}
                defaultValue={hasFilter ? year : new Date().getUTCFullYear()}
                className={`${adminInputCls} w-24`}
                required
              />
            </label>
            <label className="flex flex-col">
              <span className="mb-1.5 text-sm font-medium text-neutral-800">
                Month
              </span>
              <input
                type="number"
                name="month"
                min={1}
                max={12}
                defaultValue={hasFilter ? month : new Date().getUTCMonth() + 1}
                className={`${adminInputCls} w-20`}
                required
              />
            </label>
            <button type="submit" className={adminSecondaryBtnCls}>
              Preview
            </button>
          </form>
        </AdminFormSection>

        {previewErr ? (
          <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {previewErr}
          </div>
        ) : null}

        {previewOk ? (
          <AdminFormSection
            title={`Draft for #${previewOk.distributorId} · ${previewOk.periodYear}-${String(previewOk.periodMonth).padStart(2, '0')}`}
            subtitle="Review the line items below. Create draft writes a pending payout row; M-Pesa initiate is one more click on the detail page."
          >
            {previewOk.items.length === 0 ? (
              <p className="text-sm text-neutral-600">
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
                      <span className="text-neutral-800">{it.label}</span>
                      <span className="tabular-nums text-neutral-900">
                        {formatKes(it.amount_minor)}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="space-y-1 border-t border-neutral-200 pt-4 text-sm">
                  <Row label="Commissions" value={formatKes(previewOk.commissionsTotalMinor)} />
                  <Row label="Salary" value={formatKes(previewOk.salaryTotalMinor)} />
                  <Row label="Rank-up bonuses" value={formatKes(previewOk.rankBonusTotalMinor)} />
                  <Row label="Gross" value={formatKes(previewOk.grossTotalMinor)} bold />
                  <Row label="Fees" value={formatKes(0n)} />
                  <Row label="Net" value={formatKes(previewOk.netTotalMinor)} bold />
                </dl>

                <form action={createPayoutDraft} className="pt-2">
                  <input type="hidden" name="distributorId" value={previewOk.distributorId} />
                  <input type="hidden" name="periodYear" value={previewOk.periodYear} />
                  <input type="hidden" name="periodMonth" value={previewOk.periodMonth} />
                  <button type="submit" className={adminPrimaryBtnCls}>
                    Create draft
                  </button>
                </form>
              </>
            )}
          </AdminFormSection>
        ) : null}
      </div>
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
        bold ? 'text-base font-medium text-neutral-900' : ''
      }`}
    >
      <span className={bold ? '' : 'text-neutral-600'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
