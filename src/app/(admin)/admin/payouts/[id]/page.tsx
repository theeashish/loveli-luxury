import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { getServerEnv } from '@/lib/env'
import { initiatePayout } from './actions'

export const dynamic = 'force-dynamic'

type PayoutRow = {
  id: number
  distributor_id: number
  period_year: number
  period_month: number
  status: string
  commissions_total_minor: string
  salary_total_minor: string
  rank_bonus_total_minor: string
  retail_profit_minor: string
  gross_total_minor: string
  fees_minor: string
  net_total_minor: string
  currency: string
  payout_method: string
  payout_msisdn: string | null
  flutterwave_transfer_id: string | null
  initiated_at: string | null
  completed_at: string | null
  failure_reason: string | null
  created_at: string
}

export default async function AdminPayoutDetail({
  params,
}: {
  params: { id: string }
}) {
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const service = createServiceClient()
  const r = await service
    .from('payouts')
    .select(
      'id, distributor_id, period_year, period_month, status, commissions_total_minor, salary_total_minor, rank_bonus_total_minor, retail_profit_minor, gross_total_minor, fees_minor, net_total_minor, currency, payout_method, payout_msisdn, flutterwave_transfer_id, initiated_at, completed_at, failure_reason, created_at',
    )
    .eq('id', id)
    .maybeSingle()
  const payout = (r.data as PayoutRow | null) ?? null
  if (!payout) notFound()

  const env = getServerEnv()
  const canInitiate =
    env.ENABLE_PAYOUTS && payout.status === 'pending' && !!payout.payout_msisdn

  // Source rows that were claimed for this payout
  const [commRes, salaryRes, bonusRes] = await Promise.all([
    service
      .from('commission_ledger')
      .select('id, amount_minor, level, source_order_id, earned_at')
      .eq('payout_id', id),
    service
      .from('monthly_salaries')
      .select('id, total_minor, period_year, period_month')
      .eq('payout_id', id),
    service
      .from('rank_up_bonuses')
      .select('id, amount_minor, rank_id, awarded_at')
      .eq('payout_id', id),
  ])
  const commissions = (commRes.data ?? []) as Array<{
    id: number
    amount_minor: string
    level: number
    source_order_id: number
    earned_at: string
  }>
  const salaries = (salaryRes.data ?? []) as Array<{
    id: number
    total_minor: string
    period_year: number
    period_month: number
  }>
  const bonuses = (bonusRes.data ?? []) as Array<{
    id: number
    amount_minor: string
    rank_id: number
    awarded_at: string
  }>

  const auditRes = await service
    .from('audit_log')
    .select('id, action, occurred_at')
    .eq('resource_type', 'payouts')
    .eq('resource_id', String(id))
    .order('occurred_at', { ascending: false })
    .limit(20)
  const auditEntries = (auditRes.data ?? []) as Array<{
    id: number
    action: string
    occurred_at: string
  }>

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/payouts"
        className="text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900"
      >
        ← All payouts
      </Link>

      <header className="mt-3 mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payout · distributor #{payout.distributor_id}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {payout.period_year}-{String(payout.period_month).padStart(2, '0')} ·{' '}
            {payout.payout_method}
            {payout.payout_msisdn ? ` · ${payout.payout_msisdn}` : ''}
          </p>
        </div>
        <span className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
          {payout.status}
        </span>
      </header>

      {payout.failure_reason ? (
        <p className="mb-6 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Last error: {payout.failure_reason}
        </p>
      ) : null}

      {canInitiate ? (
        <form action={initiatePayout} className="mb-8">
          <input type="hidden" name="payoutId" value={payout.id} />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Initiate M-Pesa transfer
          </button>
        </form>
      ) : payout.status === 'pending' && !payout.payout_msisdn ? (
        <p className="mb-8 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Distributor has no verified M-Pesa number — set one before initiating.
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Totals
          </h2>
          <Row
            label="Commissions"
            value={formatKes(BigInt(payout.commissions_total_minor))}
          />
          <Row
            label="Salary"
            value={formatKes(BigInt(payout.salary_total_minor))}
          />
          <Row
            label="Rank-up bonuses"
            value={formatKes(BigInt(payout.rank_bonus_total_minor))}
          />
          {BigInt(payout.retail_profit_minor) > 0n ? (
            <Row
              label="Retail profit"
              value={formatKes(BigInt(payout.retail_profit_minor))}
            />
          ) : null}
          <div className="mt-2 border-t border-neutral-200 pt-2">
            <Row label="Gross" value={formatKes(BigInt(payout.gross_total_minor))} bold />
            <Row label="Fees" value={formatKes(BigInt(payout.fees_minor))} />
            <Row label="Net" value={formatKes(BigInt(payout.net_total_minor))} bold />
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Provider
          </h2>
          <Row label="Method" value={payout.payout_method} />
          {payout.payout_msisdn ? (
            <Row label="MSISDN" value={payout.payout_msisdn} />
          ) : null}
          {payout.flutterwave_transfer_id ? (
            <Row label="Transfer id" value={payout.flutterwave_transfer_id} />
          ) : null}
          {payout.initiated_at ? (
            <Row
              label="Initiated"
              value={new Date(payout.initiated_at).toLocaleString('en-KE')}
            />
          ) : null}
          {payout.completed_at ? (
            <Row
              label="Completed"
              value={new Date(payout.completed_at).toLocaleString('en-KE')}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Items in this payout
        </h2>
        <ul className="divide-y divide-neutral-100 text-sm">
          {commissions.map((c) => (
            <li key={`c-${c.id}`} className="flex items-center justify-between py-2">
              <span className="text-neutral-700">
                L{c.level} commission · order #{c.source_order_id}
              </span>
              <span className="tabular-nums">{formatKes(BigInt(c.amount_minor))}</span>
            </li>
          ))}
          {salaries.map((s) => (
            <li key={`s-${s.id}`} className="flex items-center justify-between py-2">
              <span className="text-neutral-700">
                Salary {s.period_year}-{String(s.period_month).padStart(2, '0')}
              </span>
              <span className="tabular-nums">{formatKes(BigInt(s.total_minor))}</span>
            </li>
          ))}
          {bonuses.map((b) => (
            <li key={`b-${b.id}`} className="flex items-center justify-between py-2">
              <span className="text-neutral-700">
                Rank-up bonus · rank #{b.rank_id}
              </span>
              <span className="tabular-nums">{formatKes(BigInt(b.amount_minor))}</span>
            </li>
          ))}
          {commissions.length + salaries.length + bonuses.length === 0 ? (
            <li className="py-2 text-neutral-500">No items linked.</li>
          ) : null}
        </ul>
      </section>

      {auditEntries.length > 0 ? (
        <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Audit log
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {auditEntries.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="font-mono text-neutral-800">{a.action}</span>
                <span className="text-xs text-neutral-500">
                  {new Date(a.occurred_at).toLocaleString('en-KE')}
                </span>
              </li>
            ))}
          </ul>
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
      className={`flex items-center justify-between py-1 ${
        bold ? 'text-base font-medium' : ''
      }`}
    >
      <span className={bold ? '' : 'text-neutral-500'}>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  )
}
