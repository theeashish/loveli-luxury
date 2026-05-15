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
  net_total_minor: string
  currency: string
  initiated_at: string | null
  completed_at: string | null
  created_at: string
}

export default async function MyPayoutsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-8 py-16 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No payouts yet.
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
