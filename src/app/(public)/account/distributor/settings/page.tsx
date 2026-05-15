/**
 * Distributor self-service settings.
 *
 * Phase 7 wave 4: submitting a new payout MSISDN now sends a 6-digit
 * SMS code (via Africa's Talking when configured; audit-log fallback
 * otherwise) and routes to /verify. Admin manual approval still
 * available as a fallback at /admin/distributors/verifications.
 */

import Link from 'next/link'
import { getCurrentDistributor } from '@/lib/distributors/current'
import { createServiceClient } from '@/lib/supabase/service'
import { submitPayoutMsisdnChange } from './actions'

export const dynamic = 'force-dynamic'

type DistRow = {
  payout_msisdn: string | null
  payout_msisdn_verified_at: string | null
  payout_msisdn_pending: string | null
  payout_msisdn_pending_at: string | null
}

export default async function DistributorSettingsPage({
  searchParams,
}: {
  searchParams?: { verified?: string }
}) {
  const me = await getCurrentDistributor()
  if (!me) return null

  const service = createServiceClient()
  const r = await service
    .from('distributors')
    .select(
      'payout_msisdn, payout_msisdn_verified_at, payout_msisdn_pending, payout_msisdn_pending_at',
    )
    .eq('id', me.id)
    .single()
  const row = (r.data as DistRow | null) ?? null

  const justVerified = searchParams?.verified === '1'

  return (
    <div className="max-w-xl space-y-8">
      {justVerified ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your new payout number is verified and live. Payouts will fire to
          it from the next cycle.
        </div>
      ) : null}

      {row?.payout_msisdn_pending ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          A verification is pending for{' '}
          <span className="font-mono">{row.payout_msisdn_pending}</span>.{' '}
          <Link
            href="/account/distributor/settings/verify"
            className="font-medium underline"
          >
            Enter your code →
          </Link>
        </div>
      ) : null}

      <section>
        <h2 className="text-base font-medium">Payout M-Pesa number</h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Where your monthly payouts are sent. Changes need admin
          verification before payouts can fire to the new number.
        </p>

        <dl className="mt-5 space-y-2 text-sm">
          <Row
            label="Current"
            value={row?.payout_msisdn ?? '—'}
            sub={
              row?.payout_msisdn_verified_at
                ? `verified ${new Date(row.payout_msisdn_verified_at).toLocaleDateString('en-KE')}`
                : 'not verified'
            }
          />
          {row?.payout_msisdn_pending ? (
            <Row
              label="Pending"
              value={row.payout_msisdn_pending}
              sub={
                row.payout_msisdn_pending_at
                  ? `submitted ${new Date(row.payout_msisdn_pending_at).toLocaleDateString('en-KE')}`
                  : ''
              }
              tone="amber"
            />
          ) : null}
        </dl>

        <form action={submitPayoutMsisdnChange} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
              New payout number (E.164)
            </span>
            <input
              type="tel"
              name="msisdn"
              required
              pattern="^\+\d{8,15}$"
              placeholder="+254712345678"
              defaultValue={row?.payout_msisdn_pending ?? ''}
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:border-[hsl(var(--primary))] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))]"
          >
            Submit for verification
          </button>
        </form>
      </section>
    </div>
  )
}

function Row({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'amber'
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 ${
        tone === 'amber'
          ? 'border-amber-300 bg-amber-50/40'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]'
      }`}
    >
      <dt className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 font-mono">{value}</dd>
      {sub ? (
        <p className="mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
          {sub}
        </p>
      ) : null}
    </div>
  )
}
