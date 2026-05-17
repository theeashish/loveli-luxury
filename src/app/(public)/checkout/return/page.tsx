/**
 * PayHero post-payment landing.
 *
 * Trigger: StkPushPanel detects the order has flipped to `paid` via
 *          /api/payhero/status polling, then redirects here with
 *          ?ref=<order_number>.
 * Role:    Read-only confirmation page. The PayHero webhook is the
 *          canonical source of truth — it flipped the order to paid
 *          before the polling client saw the change. This page only
 *          renders order state.
 *
 * The whole page is server-rendered, then a tiny client island clears
 * the cart on confirmed payment.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { ClearCartOnSuccess } from '@/components/checkout/ClearCartOnSuccess'
import { AffiliateUpgradeBanner } from '@/components/account/AffiliateUpgradeBanner'

export const metadata = {
  title: 'Order confirmation',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = {
  ref?: string
  /** Legacy Flutterwave params — accepted so old hosted-checkout return
   *  links keep redirecting to the right place; we read tx_ref as ref. */
  tx_ref?: string
}

type OrderRow = {
  id: number
  order_number: string
  status: string
  total_minor: string
  currency: string
  created_at: string
  user_id: string | null
  kind: string
}

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  const ref =
    typeof searchParams.ref === 'string'
      ? searchParams.ref
      : typeof searchParams.tx_ref === 'string'
        ? searchParams.tx_ref
        : null

  if (!ref) {
    return (
      <Shell title="Missing reference">
        <p>
          We could not match this return to an order. Please check your email
          or your account history.
        </p>
      </Shell>
    )
  }

  // Re-read the order. Auth-bound client when signed in (RLS scoped by
  // user_id); fall back to service client so we always render something.
  let orderRow: OrderRow | null = null
  if (user) {
    const r = await supabase
      .from('orders')
      .select(
        'id, order_number, status, total_minor, currency, created_at, user_id, kind',
      )
      .eq('order_number', ref)
      .eq('user_id', user.id)
      .maybeSingle()
    orderRow = (r.data as OrderRow | null) ?? null
  }
  if (!orderRow) {
    const service = createServiceClient()
    const r = await service
      .from('orders')
      .select(
        'id, order_number, status, total_minor, currency, created_at, user_id, kind',
      )
      .eq('order_number', ref)
      .maybeSingle()
    orderRow = (r.data as OrderRow | null) ?? null
  }

  if (!orderRow) {
    return (
      <Shell title="Order not found">
        <p>
          We could not find an order matching{' '}
          <code className="font-mono">{ref}</code>.
        </p>
      </Shell>
    )
  }

  const isPaid =
    orderRow.status === 'paid' ||
    orderRow.status === 'fulfilled' ||
    orderRow.status === 'shipped' ||
    orderRow.status === 'delivered'
  const isFailedOrCancelled =
    orderRow.status === 'failed' || orderRow.status === 'cancelled'

  const total = formatKes(BigInt(orderRow.total_minor))

  return (
    <Shell
      title={
        isPaid
          ? 'Payment received'
          : isFailedOrCancelled
            ? 'Payment did not complete'
            : 'Awaiting confirmation'
      }
    >
      {isPaid ? <ClearCartOnSuccess /> : null}

      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
        <dl className="space-y-3 text-sm">
          <Row label="Order">{orderRow.order_number}</Row>
          <Row label="Total">{total}</Row>
          <Row label="Status">
            <span className="uppercase tracking-[0.15em]">{orderRow.status}</span>
          </Row>
        </dl>
      </div>

      {isPaid ? (
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Thank you. We've emailed your receipt and will dispatch your order
          soon.
        </p>
      ) : isFailedOrCancelled ? (
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          No money was taken from your M-Pesa. You can try again from the cart.
        </p>
      ) : (
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Payment has not been confirmed yet. M-Pesa receipts can take a
          minute to settle — refresh this page in a moment.
        </p>
      )}

      <div className="mt-8 flex gap-3">
        {user ? (
          <Link
            href="/account/orders"
            className="rounded-md border border-[hsl(var(--border))] px-5 py-2.5 text-xs uppercase tracking-[0.15em]"
          >
            My orders
          </Link>
        ) : null}
        <Link
          href="/shop"
          className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))]"
        >
          Continue shopping
        </Link>
      </div>

      {isPaid && orderRow.kind === 'retail' ? (
        <div className="mt-12">
          <AffiliateUpgradeBanner />
        </div>
      ) : null}
    </Shell>
  )
}

function Shell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
        Checkout
      </p>
      <h1 className="mt-2 text-4xl font-light tracking-tight">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-[hsl(var(--muted-foreground))]">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}
