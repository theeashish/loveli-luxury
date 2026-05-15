/**
 * /account/orders — buyer's order history.
 *
 * RLS-scoped: the auth-bound client only returns rows where user_id matches
 * the session, per orders_self_read.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatKes } from '@/lib/money'

export const metadata = {
  title: 'My orders',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type OrderRow = {
  id: number
  order_number: string
  status: string
  kind: string
  total_minor: string
  currency: string
  created_at: string
}

export default async function MyOrdersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/account/orders')

  const r = await supabase
    .from('orders')
    .select('id, order_number, status, kind, total_minor, currency, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const orders = (r.data ?? []) as OrderRow[]

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Account</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">My orders</h1>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-8 py-16 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            You haven't placed any orders yet.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-block rounded-md border border-[hsl(var(--border))] px-6 py-3 text-xs uppercase tracking-[0.15em]"
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between gap-6 px-6 py-5 transition hover:bg-[hsl(var(--muted))]/60"
              >
                <div>
                  <p className="font-mono text-sm">{o.order_number}</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(o.created_at).toLocaleDateString('en-KE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    <span className="uppercase tracking-[0.15em]">{o.status}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {formatKes(BigInt(o.total_minor))}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
