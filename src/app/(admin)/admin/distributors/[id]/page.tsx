/**
 * /admin/distributors/[id] — single-distributor detail surface.
 *
 * Sections:
 *   - Header card: name, code, current rank, status pill
 *   - Identity / contact (email, phone, national_id, dob)
 *   - Payout (MSISDN + verified-at + any pending change)
 *   - Sponsor (upline) + direct downline counts (depth=1)
 *   - Recent commissions (last 10)
 *   - Activate / deactivate form (reason required)
 *   - Audit log (last 20)
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { setDistributorActive, createLedgerAdjustment } from './actions'

export const dynamic = 'force-dynamic'

type DistRow = {
  id: number
  user_id: string
  sponsor_code: string
  sponsor_id: number | null
  is_active: boolean
  current_rank_id: number | null
  current_rank_achieved_at: string | null
  joined_at: string
  starter_package_id: number | null
  starter_paid_at: string | null
  payout_msisdn: string | null
  payout_msisdn_verified_at: string | null
  payout_msisdn_pending: string | null
  payout_msisdn_pending_at: string | null
  kyc_status: string
  kyc_approved_at: string | null
}

type ProfileRow = {
  id: string
  email: string
  full_name: string
  phone: string | null
  national_id: string | null
  date_of_birth: string | null
}

type RankRow = {
  id: number
  rank_position: number
  rank_name: string
  emoji: string | null
}

type LedgerRow = {
  id: number
  level: number
  amount_minor: string | number
  earned_at: string
  source_order_id: number
  payout_id: number | null
}

type AuditRow = {
  id: number
  action: string
  occurred_at: string
  before_data: unknown
  after_data: unknown
}

export default async function AdminDistributorDetail({
  params,
}: {
  params: { id: string }
}) {
  const distributorId = Number(params.id)
  if (!Number.isFinite(distributorId) || distributorId <= 0) notFound()

  const service = createServiceClient()

  const dRes = await service
    .from('distributors')
    .select(
      'id, user_id, sponsor_code, sponsor_id, is_active, current_rank_id, current_rank_achieved_at, joined_at, starter_package_id, starter_paid_at, payout_msisdn, payout_msisdn_verified_at, payout_msisdn_pending, payout_msisdn_pending_at, kyc_status, kyc_approved_at',
    )
    .eq('id', distributorId)
    .maybeSingle()
  const dist = (dRes.data as DistRow | null) ?? null
  if (!dist) notFound()

  const [profileRes, rankRes, sponsorRes, downlineRes, ledgerRes, auditRes, adjRes] =
    await Promise.all([
      service
        .from('profiles')
        .select('id, email, full_name, phone, national_id, date_of_birth')
        .eq('id', dist.user_id)
        .maybeSingle(),
      dist.current_rank_id
        ? service
            .from('config_ranks')
            .select('id, rank_position, rank_name, emoji')
            .eq('id', dist.current_rank_id)
            .maybeSingle()
        : Promise.resolve({ data: null as RankRow | null }),
      dist.sponsor_id
        ? service
            .from('distributors')
            .select('id, user_id, sponsor_code')
            .eq('id', dist.sponsor_id)
            .maybeSingle()
        : Promise.resolve({ data: null as { id: number; user_id: string; sponsor_code: string } | null }),
      service
        .from('distributor_tree')
        .select('descendant_id, depth', { count: 'exact', head: false })
        .eq('ancestor_id', distributorId)
        .gt('depth', 0),
      service
        .from('commission_ledger')
        .select('id, level, amount_minor, earned_at, source_order_id, payout_id')
        .eq('distributor_id', distributorId)
        .order('earned_at', { ascending: false })
        .limit(10),
      service
        .from('audit_log')
        .select('id, action, occurred_at, before_data, after_data')
        .eq('resource_type', 'distributors')
        .eq('resource_id', String(distributorId))
        .order('occurred_at', { ascending: false })
        .limit(20),
      service
        .from('manual_ledger_adjustments')
        .select('id, amount_minor, period_year, period_month, reason, payout_id, created_at')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

  const profile = (profileRes.data as ProfileRow | null) ?? null
  const rank = (rankRes.data as RankRow | null) ?? null
  const sponsor =
    (sponsorRes.data as { id: number; user_id: string; sponsor_code: string } | null) ?? null
  const tree = (downlineRes.data ?? []) as Array<{ descendant_id: number; depth: number }>
  const ledger = (ledgerRes.data ?? []) as LedgerRow[]
  const audits = (auditRes.data ?? []) as AuditRow[]
  type AdjustmentRow = {
    id: number
    amount_minor: string | number
    period_year: number
    period_month: number
    reason: string
    payout_id: number | null
    created_at: string
  }
  const adjustments = (adjRes.data ?? []) as AdjustmentRow[]
  const nowDate = new Date()
  const defaultYear = nowDate.getUTCFullYear()
  const defaultMonth = nowDate.getUTCMonth() + 1

  // Resolve sponsor's name
  let sponsorName: string | null = null
  if (sponsor) {
    const sp = await service
      .from('profiles')
      .select('full_name')
      .eq('id', sponsor.user_id)
      .maybeSingle()
    sponsorName = (sp.data as { full_name: string } | null)?.full_name ?? null
  }

  const directDownline = tree.filter((t) => t.depth === 1).length
  const totalDownline = tree.length

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/distributors"
        className="text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900"
      >
        ← All distributors
      </Link>

      <header className="mt-3 mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile?.full_name ?? `#${dist.id}`}
          </h1>
          <p className="mt-1 font-mono text-sm text-neutral-500">
            {dist.sponsor_code}
            {' · '}
            joined{' '}
            {new Date(dist.joined_at).toLocaleDateString('en-KE', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <span
          className={`rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] ${
            dist.is_active
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : 'border-rose-300 bg-rose-50 text-rose-800'
          }`}
        >
          {dist.is_active ? 'active' : 'inactive'}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Identity">
          <Row label="Email" value={profile?.email ?? '—'} />
          <Row label="Phone" value={profile?.phone ?? '—'} />
          <Row label="National ID" value={profile?.national_id ?? '—'} />
          <Row
            label="Date of birth"
            value={
              profile?.date_of_birth
                ? new Date(profile.date_of_birth).toLocaleDateString('en-KE')
                : '—'
            }
          />
          <Row label="KYC" value={dist.kyc_status} />
        </Card>

        <Card title="Rank & sponsor">
          <Row
            label="Current rank"
            value={
              rank
                ? `${rank.emoji ? rank.emoji + ' ' : ''}${rank.rank_name}`
                : 'Newbie'
            }
          />
          <Row
            label="Rank since"
            value={
              dist.current_rank_achieved_at
                ? new Date(dist.current_rank_achieved_at).toLocaleDateString('en-KE')
                : '—'
            }
          />
          <Row
            label="Sponsor"
            value={
              sponsor
                ? `${sponsorName ?? sponsor.sponsor_code} (${sponsor.sponsor_code})`
                : '—'
            }
          />
          <Row label="Direct downline (L1)" value={String(directDownline)} />
          <Row label="Total downline" value={String(totalDownline)} />
        </Card>

        <Card title="Payout">
          <Row label="MSISDN" value={dist.payout_msisdn ?? '—'} />
          <Row
            label="Verified"
            value={
              dist.payout_msisdn_verified_at
                ? new Date(dist.payout_msisdn_verified_at).toLocaleDateString('en-KE')
                : '—'
            }
          />
          {dist.payout_msisdn_pending ? (
            <Row
              label="Pending"
              value={`${dist.payout_msisdn_pending} (submitted ${
                dist.payout_msisdn_pending_at
                  ? new Date(dist.payout_msisdn_pending_at).toLocaleDateString('en-KE')
                  : '—'
              })`}
            />
          ) : null}
        </Card>

        <Card title="Onboarding">
          <Row label="Starter package id" value={dist.starter_package_id ? `#${dist.starter_package_id}` : '—'} />
          <Row
            label="Starter paid"
            value={
              dist.starter_paid_at
                ? new Date(dist.starter_paid_at).toLocaleDateString('en-KE')
                : '—'
            }
          />
        </Card>
      </div>

      {/* Status toggle */}
      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          {dist.is_active ? 'Deactivate' : 'Reactivate'}
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          {dist.is_active
            ? 'Removes earning eligibility. Existing commissions remain payable.'
            : 'Restores earning eligibility. No backfill — only commissions written after reactivation count.'}
        </p>
        <form action={setDistributorActive} className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="distributorId" value={dist.id} />
          <input type="hidden" name="active" value={dist.is_active ? 'false' : 'true'} />
          <label className="flex flex-1 min-w-[20rem] flex-col">
            <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
              Reason (required, min 3 chars)
            </span>
            <input
              type="text"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              placeholder={dist.is_active ? 'Why deactivate?' : 'Why reactivate?'}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className={`rounded-md px-4 py-2 text-sm text-white ${
              dist.is_active ? 'bg-rose-700' : 'bg-emerald-700'
            }`}
          >
            {dist.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Recent commissions
        </h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-neutral-500">No commission rows yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {ledger.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-6 py-2"
              >
                <div>
                  <p className="font-mono text-xs">L{row.level} · order #{row.source_order_id}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(row.earned_at).toLocaleString('en-KE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                    {row.payout_id ? ` · payout #${row.payout_id}` : ' · unpaid'}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatKes(BigInt(row.amount_minor))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
          Manual ledger adjustment
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          Positive amount credits the distributor; negative debits.
          Included in the chosen period's next payout draft. KES, integer
          (no decimals).
        </p>
        <form
          action={createLedgerAdjustment}
          className="grid grid-cols-1 gap-3 md:grid-cols-[8rem_6rem_6rem_1fr_auto] md:items-end"
        >
          <input type="hidden" name="distributorId" value={dist.id} />
          <label className="flex flex-col">
            <span className="mb-1 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
              Amount (KES, signed)
            </span>
            <input
              type="number"
              name="amountKes"
              required
              placeholder="e.g. 1500 or -500"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
              Year
            </span>
            <input
              type="number"
              name="periodYear"
              min={2024}
              max={2099}
              defaultValue={defaultYear}
              required
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
              Month
            </span>
            <input
              type="number"
              name="periodMonth"
              min={1}
              max={12}
              defaultValue={defaultMonth}
              required
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-col">
            <span className="mb-1 text-[10px] uppercase tracking-[0.15em] text-neutral-500">
              Reason (min 3 chars)
            </span>
            <input
              type="text"
              name="reason"
              minLength={3}
              maxLength={2000}
              required
              placeholder="e.g. Goodwill credit · ticket #1234"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Adjust
          </button>
        </form>

        {adjustments.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-md border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {adjustments.map((adj) => {
                  const minor = BigInt(adj.amount_minor)
                  const signedKes = Number(minor) / 100
                  return (
                    <tr key={adj.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        {adj.period_year}-
                        {String(adj.period_month).padStart(2, '0')}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-700">
                        {adj.reason}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium tabular-nums ${
                          signedKes < 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {signedKes < 0 ? '−' : '+'}
                        {formatKes(minor < 0n ? -minor : minor)}
                      </td>
                      <td className="px-3 py-2 text-xs text-neutral-500">
                        {adj.payout_id
                          ? `In payout #${adj.payout_id}`
                          : 'Unpaid'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {audits.length > 0 ? (
        <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Audit log
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {audits.map((a) => (
              <li key={a.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-neutral-800">{a.action}</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(a.occurred_at).toLocaleString('en-KE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
      <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
        {title}
      </h2>
      <dl className="space-y-1">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
