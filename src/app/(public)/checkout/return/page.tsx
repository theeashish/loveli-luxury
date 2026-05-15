/**
 * Flutterwave redirect-return landing.
 *
 * Trigger:  the buyer is sent here after the hosted-checkout page finishes
 *           (success, failure, or cancel). Query params come from FW.
 * Role:     UX fast-path for marking an order paid before the webhook has
 *           necessarily fired. The webhook is the canonical source of truth;
 *           this page shares the same idempotent RPC, so duplicate calls are
 *           safe.
 *
 * Behaviour:
 *   - If status=successful + a valid transaction_id, we re-verify via the
 *     Flutterwave API, then call mark_order_paid. If the webhook beat us,
 *     the RPC simply no-ops and we still display the paid order.
 *   - If status is anything else (failed/cancelled), we just render the
 *     order's current state without touching it.
 *
 * The whole page is server-rendered, then a tiny client island clears the
 * cart on confirmed payment.
 */

import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyTransaction } from '@/lib/flutterwave/service'
import { formatKes } from '@/lib/money'
import { ClearCartOnSuccess } from '@/components/checkout/ClearCartOnSuccess'

export const metadata = {
  title: 'Order confirmation',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type SearchParams = {
  status?: string
  tx_ref?: string
  transaction_id?: string
}

type OrderRow = {
  id: number
  order_number: string
  status: string
  total_minor: string
  currency: string
  created_at: string
  user_id: string | null
}

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const txRef = typeof searchParams.tx_ref === 'string' ? searchParams.tx_ref : null
  const status = typeof searchParams.status === 'string' ? searchParams.status : null
  const transactionId =
    typeof searchParams.transaction_id === 'string'
      ? Number(searchParams.transaction_id)
      : null

  if (!txRef) {
    return <Shell title="Missing reference">
      <p>We could not match this return to an order. Please check your email or your account history.</p>
    </Shell>
  }

  // 1. Fast-path verify when FW says success. Tolerant of every error path —
  //    we always fall through to displaying whatever the order's current row
  //    looks like.
  if (status === 'successful' && transactionId && Number.isFinite(transactionId)) {
    try {
      const verified = await verifyTransaction(transactionId)
      if (
        verified.status === 'successful' &&
        verified.tx_ref === txRef
      ) {
        const service = createServiceClient()
        const orderForCheck = await service
          .from('orders')
          .select('id, total_minor, currency, kind')
          .eq('order_number', txRef)
          .maybeSingle()
        const checked = orderForCheck.data as
          | { id: number; total_minor: string; currency: string; kind: string }
          | null
        if (
          checked &&
          verified.currency === checked.currency &&
          verified.amount === Number(BigInt(checked.total_minor) / 100n)
        ) {
          const rpcRes = await service.rpc('mark_order_paid', {
            p_order_id: checked.id,
            p_provider_ref: String(verified.id),
          })
          if (!rpcRes.error && rpcRes.data === true) {
            // Best-effort follow-ups. Errors here only mean the webhook
            // will (eventually) re-run them; the order itself is paid.
            if (checked.kind === 'distributor_signup') {
              try {
                await service.rpc('provision_distributor', {
                  p_order_id: checked.id,
                })
              } catch {
                // webhook retry will resolve
              }
            }
            try {
              await service.rpc('write_commission_ledger', {
                p_order_id: checked.id,
              })
            } catch {
              // webhook retry will resolve
            }
            try {
              revalidatePath('/shop')
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // Swallow — render whatever the DB now says.
    }
  }

  // 2. Re-read the order. Use the auth-bound client when the buyer is signed
  //    in (RLS scopes by user_id). Fall back to service client to surface a
  //    minimal record when the session was lost between FW and us.
  let orderRow: OrderRow | null = null
  if (user) {
    const r = await supabase
      .from('orders')
      .select('id, order_number, status, total_minor, currency, created_at, user_id')
      .eq('order_number', txRef)
      .eq('user_id', user.id)
      .maybeSingle()
    orderRow = (r.data as OrderRow | null) ?? null
  }
  if (!orderRow) {
    const service = createServiceClient()
    const r = await service
      .from('orders')
      .select('id, order_number, status, total_minor, currency, created_at, user_id')
      .eq('order_number', txRef)
      .maybeSingle()
    orderRow = (r.data as OrderRow | null) ?? null
  }

  if (!orderRow) {
    return (
      <Shell title="Order not found">
        <p>We could not find an order matching <code className="font-mono">{txRef}</code>.</p>
      </Shell>
    )
  }

  const isPaid = orderRow.status === 'paid' ||
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
          Thank you. We've emailed your receipt and will dispatch your order soon.
        </p>
      ) : isFailedOrCancelled ? (
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Your card was not charged. You can try again from the cart.
        </p>
      ) : (
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Flutterwave hasn't confirmed payment yet. This page will update once
          we receive the webhook — refresh in a moment.
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
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Checkout</p>
      <h1 className="mt-2 text-4xl font-light tracking-tight">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-[hsl(var(--muted-foreground))]">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}
