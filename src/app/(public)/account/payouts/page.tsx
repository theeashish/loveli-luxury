/**
 * /account/payouts — read-only list for distributors.
 *
 * RLS scopes by distributor_id matching the signed-in user's distributor row.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatKes } from '@/lib/money'

export const metadata = {
  title: 'My payouts',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type PayoutRow = {
  id: number
  period_year: number
  period_month: number
  status: string
  net_total_minor: string | number
  currency: string
  initiated_at: string | null
  completed_at: string | null
  created_at: string
}

export default async function MyPayoutsPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?next=/account/payouts')

  const r = await supabase
    .from('payouts')
    .select(
      'id, period_year, period_month, status, net_total_minor, currency, initiated_at, completed_at, created_at',
    )
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(60)
  const rows = (r.data ?? []) as PayoutRow[]

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Account</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">My payouts</h1>
      </header>

      {/*
        Locked payout policy (Option A, 2026-05-31).
        Earnings settle on the 1st of each calendar month; partners do not
        request payouts. This explanation is intentionally short and lives
        directly above the payout list so a partner who lands here looking
        for a "Request payout" button sees the rule first.
      */}
      <section
        aria-label="How payouts work"
        className="mb-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--primary))]">
          How payouts work
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--foreground))]">
          Your earnings settle on the 1st of each month for the previous
          month's verified retail sales. There is no "request payout"
          step — Loveli drafts and issues every eligible payout. Your job
          is to keep your M-Pesa number current and verified in{' '}
          <Link
            href="/account/partner/settings"
            className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
          >
            settings
          </Link>
          .
        </p>
        <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          Refunded orders trigger a clawback against the same partners who
          earned on them — that's reflected in the next cycle's net, not as
          a separate transaction. See{' '}
          <Link
            href="/ids"
            className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
          >
            the income disclosure statement
          </Link>{' '}
          for the full program rules.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-8 py-16 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No payouts yet. Once you've placed verified retail sales, your
            first payout drafts on the 1st of the following month.
          </p>
          <Link
            href="/account/orders"
            className="mt-6 inline-block rounded-md border border-[hsl(var(--border))] px-6 py-3 text-xs uppercase tracking-[0.15em]"
          >
            Back to orders
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
          {rows.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-6 px-6 py-5"
            >
              <div>
                <p className="font-medium">
                  {p.period_year}-{String(p.period_month).padStart(2, '0')}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  {p.status}
                  {p.completed_at
                    ? ` · paid ${new Date(p.completed_at).toLocaleDateString('en-KE')}`
                    : p.initiated_at
                      ? ` · initiated ${new Date(p.initiated_at).toLocaleDateString('en-KE')}`
                      : ''}
                </p>
              </div>
              <p className="text-right font-medium tabular-nums">
                {formatKes(BigInt(p.net_total_minor))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
