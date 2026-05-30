/**
 * /track/[orderNumber] — public order tracking.
 *
 * Anyone with the order number can read the page. No login required.
 * To stop the URL leaking PII, every customer string is masked
 * (full name → first-letter-plus-stars; phone → last-3-digits).
 *
 * Reads from the orders table via the service-role client, filtered to
 * the exact order_number. No fallback wildcard / list endpoints — must
 * know the precise number.
 *
 * Security note (Phase 4a accepts): the existing LL-YYYY-NNNNNN
 * sequence is guessable. Phase 4b appends a 4-char random suffix at
 * generation time. Until then, the masked output is what protects PII
 * in the case of a guessed number.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { maskEmail, maskPhone } from '@/lib/orders/mask'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Order tracking',
  robots: { index: false, follow: false },
}

type AnyStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'refunded'

const STATUS_FLOW: ReadonlyArray<{
  key: AnyStatus
  label: string
  desc: string
}> = [
  { key: 'pending',   label: 'Pending payment', desc: 'M-Pesa prompt sent. Awaiting confirmation.' },
  { key: 'paid',      label: 'Paid',            desc: 'Payment confirmed. Preparing your order.' },
  { key: 'fulfilled', label: 'Packed',          desc: 'Bottles sealed, parcel ready for the courier.' },
  { key: 'shipped',   label: 'In transit',      desc: 'Handed to the courier.' },
  { key: 'delivered', label: 'Delivered',       desc: 'Received by you (or your delegate).' },
]

const STATUS_INDEX: Record<AnyStatus, number> = {
  pending:   0,
  paid:      1,
  fulfilled: 2,
  shipped:   3,
  delivered: 4,
  failed:    -1,
  cancelled: -1,
  expired:   -1,
  refunded:  -1,
}

export default async function TrackOrderPage({
  params,
}: {
  params: { orderNumber: string }
}) {
  const orderNumber = decodeURIComponent(params.orderNumber).toUpperCase().trim()
  if (!orderNumber) notFound()

  const service = createServiceClient()
  const r = await service
    .from('orders')
    .select(
      'order_number, status, kind, customer_email, customer_phone, total_minor, currency, created_at, paid_at, payment_provider, notes',
    )
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (r.error) {
    return (
      <Shell title="Tracking unavailable" eyebrow="Order tracking">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          We could not look up{' '}
          <code className="font-mono">{orderNumber}</code> right now. Try again
          in a minute, or message our Concierge for help.
        </p>
      </Shell>
    )
  }

  const order = r.data as
    | {
        order_number: string
        status: AnyStatus
        kind: string
        customer_email: string | null
        customer_phone: string | null
        total_minor: string | number
        currency: string
        created_at: string
        paid_at: string | null
        payment_provider: string | null
        notes: string | null
      }
    | null

  if (!order) {
    return (
      <Shell title="Order not found" eyebrow="Order tracking">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          We could not find an order with number{' '}
          <code className="font-mono">{orderNumber}</code>. Check the
          confirmation we sent you, or message our Concierge for help locating
          it.
        </p>
        <Link
          href="/track"
          className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          Try a different number
        </Link>
      </Shell>
    )
  }

  // Best-effort recipient extraction from notes. Distributor signup
  // stores a JSON blob; otherwise we have no shipping name in the
  // orders row itself. So we extract the M-Pesa-payer-side info from
  // customer_email + customer_phone instead, both masked.
  const maskedEmail = maskEmail(order.customer_email)
  const maskedPhone = maskPhone(order.customer_phone)

  const isTerminal = STATUS_INDEX[order.status] === -1
  const currentStep = STATUS_INDEX[order.status]

  return (
    <Shell
      title={
        isTerminal
          ? terminalTitleFor(order.status)
          : `Order ${order.order_number}`
      }
      eyebrow="Order tracking"
    >
      <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_18rem]">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Status
          </p>
          <p className="mt-2 font-serif text-3xl tracking-tight">
            {isTerminal
              ? terminalLabelFor(order.status)
              : STATUS_FLOW[currentStep]!.label}
          </p>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {isTerminal
              ? terminalCopyFor(order.status)
              : STATUS_FLOW[currentStep]!.desc}
          </p>

          {!isTerminal ? (
            <ol className="mt-10 space-y-4">
              {STATUS_FLOW.map((step, i) => {
                const reached = i <= currentStep
                const isNow = i === currentStep
                return (
                  <li
                    key={step.key}
                    className="flex items-start gap-4 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1 h-3 w-3 flex-none rounded-full border ${
                        reached
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]'
                          : 'border-[hsl(var(--border))] bg-transparent'
                      } ${isNow ? 'ring-2 ring-[hsl(var(--primary))]/40' : ''}`}
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          reached
                            ? 'text-[hsl(var(--foreground))]'
                            : 'text-[hsl(var(--muted-foreground))]'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                        {step.desc}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : null}
        </div>

        <aside className="rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/30 p-5 text-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Order
          </p>
          <p className="mt-1 font-mono text-base text-[hsl(var(--foreground))]">
            {order.order_number}
          </p>
          <div className="mt-5 space-y-3">
            <Row
              label="Placed"
              value={new Date(order.created_at).toLocaleString('en-KE', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            />
            {order.paid_at ? (
              <Row
                label="Paid"
                value={new Date(order.paid_at).toLocaleString('en-KE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
            ) : null}
            <Row
              label="Total"
              value={`${order.currency} ${formatKes(BigInt(order.total_minor))}`}
            />
            <Row label="Buyer phone" value={maskedPhone || '-'} />
            <Row label="Buyer email" value={maskedEmail || '-'} />
          </div>
          <p className="mt-6 text-xs text-[hsl(var(--muted-foreground))]">
            Need a hand? Message our{' '}
            <span className="text-[hsl(var(--foreground))]">Concierge</span> via
            the WhatsApp button bottom-right.
          </p>
        </aside>
      </div>
    </Shell>
  )
}

function terminalTitleFor(s: AnyStatus): string {
  switch (s) {
    case 'failed':    return 'Payment failed'
    case 'cancelled': return 'Order cancelled'
    case 'expired':   return 'Order expired'
    case 'refunded':  return 'Order refunded'
    default:          return 'Order'
  }
}

function terminalLabelFor(s: AnyStatus): string {
  switch (s) {
    case 'failed':    return 'Payment failed'
    case 'cancelled': return 'Cancelled'
    case 'expired':   return 'Expired'
    case 'refunded':  return 'Refunded'
    default:          return 'Closed'
  }
}

function terminalCopyFor(s: AnyStatus): string {
  switch (s) {
    case 'failed':
      return 'M-Pesa did not confirm payment for this order. Try again from your cart, or ask the Concierge to investigate.'
    case 'cancelled':
      return 'This order was cancelled before payment. No money has left your M-Pesa.'
    case 'expired':
      return 'This order was abandoned before payment confirmed. Start a new checkout when you are ready.'
    case 'refunded':
      return 'This order was refunded. The reversal lands on the M-Pesa number you paid from within 5 business days.'
    default:
      return ''
  }
}

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20 md:py-24">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
        {title}
      </h1>
      <div className="mt-10">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        {label}
      </span>
      <span className="text-right text-[hsl(var(--foreground))]">{value}</span>
    </div>
  )
}
