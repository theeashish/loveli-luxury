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
import { AccountStatusCard } from '@/components/account/AccountStatusCard'

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
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?next=/account/orders')

  const r = await supabase
    .from('orders')
    .select('id, order_number, status, kind, total_minor, currency, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const orders = (r.data ?? []) as OrderRow[]
  const signupOrders = orders.filter((o) => o.kind === 'distributor_signup')
  const retailOrders = orders.filter((o) => o.kind !== 'distributor_signup')

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Account</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">My orders</h1>
      </header>

      <div className="mb-8">
        <AccountStatusCard />
      </div>

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
        <div className="space-y-10">
          {signupOrders.length > 0 ? (
            <OrderGroup
              title="Signup attempts"
              subtitle="Distributor signup orders. Pending rows are attempts where M-Pesa payment did not confirm — they are not perfume purchases."
              orders={signupOrders}
              variant="signup"
            />
          ) : null}
          {retailOrders.length > 0 ? (
            <OrderGroup
              title="Perfume orders"
              subtitle="Items shipped to you."
              orders={retailOrders}
              variant="retail"
            />
          ) : null}
          {retailOrders.length === 0 && signupOrders.length > 0 ? (
            <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-8 py-10 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                You haven't bought any perfume yet — only signup attempts above.
              </p>
              <Link
                href="/shop"
                className="mt-4 inline-block rounded-md border border-[hsl(var(--border))] px-6 py-3 text-xs uppercase tracking-[0.15em]"
              >
                Browse the collection
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function OrderGroup({
  title,
  subtitle,
  orders,
  variant,
}: {
  title: string
  subtitle: string
  orders: OrderRow[]
  variant: 'signup' | 'retail'
}) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {subtitle}
        </p>
      </header>
      <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/account/orders/${o.id}`}
              className="flex items-center justify-between gap-6 px-6 py-5 transition hover:bg-[hsl(var(--muted))]/60"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm">{o.order_number}</p>
                  <KindBadge variant={variant} />
                  <StatusBadge variant={variant} status={o.status} />
                </div>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {new Date(o.created_at).toLocaleDateString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
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
    </section>
  )
}

function KindBadge({ variant }: { variant: 'signup' | 'retail' }) {
  const label = variant === 'signup' ? 'Signup' : 'Retail'
  const cls =
    variant === 'signup'
      ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
      : 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
  return (
    <span
      className={`inline-block rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.2em] ${cls}`}
    >
      {label}
    </span>
  )
}

function StatusBadge({
  variant,
  status,
}: {
  variant: 'signup' | 'retail'
  status: string
}) {
  // Friendly relabel: pending signup orders are "payment incomplete" so
  // the user sees what went wrong instead of a generic PENDING.
  let label = status
  let tone =
    'border-[hsl(var(--muted-foreground))]/30 text-[hsl(var(--muted-foreground))]'
  if (variant === 'signup' && status === 'pending') {
    label = 'Payment incomplete'
    tone = 'border-rose-400/40 bg-rose-500/10 text-rose-300'
  } else if (status === 'paid') {
    tone = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  } else if (status === 'cancelled' || status === 'refunded') {
    tone = 'border-[hsl(var(--muted-foreground))]/40 text-[hsl(var(--muted-foreground))]'
  }
  return (
    <span
      className={`inline-block rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.2em] ${tone}`}
    >
      {label}
    </span>
  )
}
