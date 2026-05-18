/**
 * /admin/orders/[id] — admin order detail with state-transition controls.
 *
 * Items, address and audit log are joined in via the service-role client so
 * deactivated catalog rows still render.
 */

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { transitionOrderStatus, reconcilePayheroPayment } from './actions'
import { ALLOWED_ACTIONS } from './transitions'

export const dynamic = 'force-dynamic'

type AnyStatus =
  | 'pending' | 'paid' | 'failed' | 'cancelled'
  | 'fulfilled' | 'shipped' | 'delivered' | 'refunded'

type OrderRow = {
  id: number
  order_number: string
  status: AnyStatus
  kind: string
  customer_email: string
  customer_phone: string | null
  subtotal_minor: string
  shipping_minor: string
  tax_minor: string
  discount_minor: string
  total_minor: string
  currency: string
  created_at: string
  paid_at: string | null
  payment_provider: string | null
  payment_provider_ref: string | null
  payhero_checkout_reference: string | null
  payhero_mpesa_receipt: string | null
  shipping_address_id: number | null
  sponsor_distributor_id: number | null
  notes: string | null
  user_id: string | null
}

type OrderItemRow = {
  id: number
  variant_id: number | null
  bundle_id: number | null
  quantity: number
  unit_price_minor: string
  line_total_minor: string
  is_commissionable: boolean
  commissionable_amount_minor: string
}

type AuditRow = {
  id: number
  action: string
  actor_id: string | null
  before_data: unknown
  after_data: unknown
  occurred_at: string
}

const ACTION_LABELS: Record<string, string> = {
  cancel: 'Cancel order',
  fulfill: 'Mark fulfilled',
  ship: 'Mark shipped',
  deliver: 'Mark delivered',
  refund: 'Mark refunded',
}

const ACTION_VARIANTS: Record<string, 'primary' | 'danger' | 'neutral'> = {
  fulfill: 'primary',
  ship: 'primary',
  deliver: 'primary',
  cancel: 'danger',
  refund: 'danger',
}

export default async function AdminOrderDetail({
  params,
}: {
  params: { id: string }
}) {
  const orderId = Number(params.id)
  if (!Number.isFinite(orderId) || orderId <= 0) notFound()

  const service = createServiceClient()
  const orderRes = await service
    .from('orders')
    .select(
      'id, order_number, status, kind, customer_email, customer_phone, subtotal_minor, shipping_minor, tax_minor, discount_minor, total_minor, currency, created_at, paid_at, payment_provider, payment_provider_ref, payhero_checkout_reference, payhero_mpesa_receipt, shipping_address_id, sponsor_distributor_id, notes, user_id',
    )
    .eq('id', orderId)
    .maybeSingle()
  const order = (orderRes.data as OrderRow | null) ?? null
  if (!order) notFound()

  const itemsRes = await service
    .from('order_items')
    .select(
      'id, variant_id, bundle_id, quantity, unit_price_minor, line_total_minor, is_commissionable, commissionable_amount_minor',
    )
    .eq('order_id', orderId)
    .order('id')
  const items = (itemsRes.data ?? []) as OrderItemRow[]

  const variantIds = items.map((i) => i.variant_id).filter((x): x is number => x !== null)
  const bundleIds = items.map((i) => i.bundle_id).filter((x): x is number => x !== null)

  const [variantsRes, bundlesRes] = await Promise.all([
    variantIds.length
      ? service
          .from('product_variants')
          .select('id, sku, size_ml, product_id')
          .in('id', variantIds)
      : Promise.resolve({ data: [] as Array<{ id: number; sku: string; size_ml: number; product_id: number }> }),
    bundleIds.length
      ? service.from('bundles').select('id, name, slug').in('id', bundleIds)
      : Promise.resolve({ data: [] as Array<{ id: number; name: string; slug: string }> }),
  ])
  const variants = (variantsRes.data ?? []) as Array<{
    id: number; sku: string; size_ml: number; product_id: number
  }>
  const bundles = (bundlesRes.data ?? []) as Array<{ id: number; name: string; slug: string }>
  const productIds = Array.from(new Set(variants.map((v) => v.product_id)))
  const productsRes = productIds.length
    ? await service.from('products').select('id, name, slug').in('id', productIds)
    : { data: [] as Array<{ id: number; name: string; slug: string }> }
  const products = (productsRes.data ?? []) as Array<{ id: number; name: string; slug: string }>

  type AddressView = {
    recipient_name: string
    phone: string
    street_line_1: string
    street_line_2: string | null
    city: string
    region: string | null
    postal_code: string | null
    country_code: string
  }
  let address: AddressView | null = null
  if (order.shipping_address_id) {
    const r = await service
      .from('addresses')
      .select('recipient_name, phone, street_line_1, street_line_2, city, region, postal_code, country_code')
      .eq('id', order.shipping_address_id)
      .maybeSingle()
    address = (r.data as AddressView | null) ?? null
  }

  const auditRes = await service
    .from('audit_log')
    .select('id, action, actor_id, before_data, after_data, occurred_at')
    .eq('resource_type', 'orders')
    .eq('resource_id', String(orderId))
    .order('occurred_at', { ascending: false })
    .limit(20)
  const auditEntries = (auditRes.data ?? []) as AuditRow[]

  const allowed = ALLOWED_ACTIONS[order.status] ?? []

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/orders"
        className="text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900"
      >
        ← All orders
      </Link>

      <header className="mt-3 mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl">{order.order_number}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {order.kind} · placed{' '}
            {new Date(order.created_at).toLocaleString('en-KE', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {order.paid_at ? ` · paid ${new Date(order.paid_at).toLocaleString('en-KE')}` : ''}
          </p>
        </div>
        <span className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
          {order.status}
        </span>
      </header>

      {order.status === 'pending' && order.payment_provider === 'payhero' ? (
        <section className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-900">
            Stuck pending — reconcile with PayHero
          </h2>
          <p className="mt-2 text-sm text-amber-900/80">
            This order has a PayHero checkout reference but never flipped to
            paid. Click to query PayHero&apos;s transaction-status endpoint and,
            if it reports SUCCESS with matching amount, run the same
            <code className="mx-1 rounded bg-amber-100 px-1 font-mono">mark_order_paid</code>
            chain the webhook would. Safe to click multiple times — idempotent.
          </p>
          <form action={reconcilePayheroPayment} className="mt-3">
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              disabled={!order.payhero_checkout_reference}
              className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              title={
                order.payhero_checkout_reference
                  ? 'Reconcile against PayHero'
                  : 'No PayHero checkout reference on this order — cannot reconcile'
              }
            >
              Reconcile PayHero payment
            </button>
            {!order.payhero_checkout_reference ? (
              <p className="mt-2 text-xs text-amber-900/70">
                Missing <code className="font-mono">payhero_checkout_reference</code>;
                the STK push likely never returned a reference. Cannot reconcile.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      {allowed.length > 0 ? (
        <section className="mb-8 flex flex-wrap gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          {allowed.map((a) => {
            const variant = ACTION_VARIANTS[a] ?? 'neutral'
            const cls =
              variant === 'primary'
                ? 'bg-neutral-900 text-white'
                : variant === 'danger'
                  ? 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
                  : 'border border-neutral-300 bg-white text-neutral-800'
            return (
              <form action={transitionOrderStatus} key={a}>
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="action" value={a} />
                <button
                  type="submit"
                  className={`rounded-md px-4 py-2 text-sm ${cls}`}
                >
                  {ACTION_LABELS[a]}
                </button>
              </form>
            )
          })}
        </section>
      ) : (
        <p className="mb-8 rounded-md border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-500">
          No further state transitions available from <strong>{order.status}</strong>.
        </p>
      )}

      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit</th>
              <th className="px-4 py-3 text-right">Line</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.map((it) => {
              const isV = it.variant_id !== null
              let label = ''
              let sub = ''
              if (isV) {
                const v = variants.find((x) => x.id === it.variant_id)
                const p = v ? products.find((x) => x.id === v.product_id) : null
                label = p?.name ?? `Variant #${it.variant_id}`
                sub = v ? `${v.sku} · ${v.size_ml}ml` : ''
              } else {
                const b = bundles.find((x) => x.id === it.bundle_id)
                label = b?.name ?? `Bundle #${it.bundle_id}`
                sub = b?.slug ?? ''
              }
              return (
                <tr key={it.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{label}</div>
                    <div className="text-xs text-neutral-500">{sub}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatKes(BigInt(it.unit_price_minor))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatKes(BigInt(it.line_total_minor))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Totals
          </h2>
          <Row label="Subtotal" value={formatKes(BigInt(order.subtotal_minor))} />
          <Row label="Shipping" value={formatKes(BigInt(order.shipping_minor))} />
          {BigInt(order.discount_minor) > 0n ? (
            <Row label="Discount" value={`−${formatKes(BigInt(order.discount_minor))}`} />
          ) : null}
          {BigInt(order.tax_minor) > 0n ? (
            <Row label="Tax" value={formatKes(BigInt(order.tax_minor))} />
          ) : null}
          <div className="mt-2 border-t border-neutral-200 pt-2">
            <Row label="Total" value={formatKes(BigInt(order.total_minor))} bold />
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Customer
          </h2>
          <p>{order.customer_email}</p>
          {order.customer_phone ? (
            <p className="text-neutral-600">{order.customer_phone}</p>
          ) : null}
          {order.sponsor_distributor_id ? (
            <p className="mt-2 text-xs text-neutral-500">
              Sponsor distributor #{order.sponsor_distributor_id}
            </p>
          ) : null}

          <h2 className="mb-3 mt-5 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Shipping
          </h2>
          {address ? (
            <address className="not-italic leading-relaxed">
              <div className="font-medium">{address.recipient_name}</div>
              <div className="text-neutral-600">{address.street_line_1}</div>
              {address.street_line_2 ? (
                <div className="text-neutral-600">{address.street_line_2}</div>
              ) : null}
              <div className="text-neutral-600">
                {address.city}
                {address.region ? `, ${address.region}` : ''}
                {address.postal_code ? ` ${address.postal_code}` : ''}
              </div>
              <div className="text-neutral-600">{address.country_code}</div>
              <div className="mt-1 text-xs text-neutral-500">{address.phone}</div>
            </address>
          ) : (
            <p className="text-neutral-500">No address.</p>
          )}

          {order.payment_provider_ref ? (
            <>
              <h2 className="mb-3 mt-5 text-xs uppercase tracking-[0.2em] text-neutral-500">
                Payment
              </h2>
              <p className="font-mono text-xs text-neutral-700">
                {order.payment_provider} · {order.payment_provider_ref}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {auditEntries.length > 0 ? (
        <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Audit log
          </h2>
          <ul className="divide-y divide-neutral-100 text-sm">
            {auditEntries.map((a) => (
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
    <div className={`flex items-center justify-between py-1 ${bold ? 'text-base font-medium' : ''}`}>
      <span className={bold ? '' : 'text-neutral-500'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
