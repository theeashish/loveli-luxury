/**
 * /account/orders/[id] — single-order detail for the buyer.
 *
 * The auth-bound client + orders_self_read RLS gates access; we additionally
 * 404 if no row is returned. Item lookups (variants/bundles/products) use the
 * service client because some referenced rows may be inactive after the fact.
 */

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const metadata = {
  title: 'Order detail',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type OrderRow = {
  id: number
  order_number: string
  status: string
  kind: string
  subtotal_minor: string
  shipping_minor: string
  tax_minor: string
  discount_minor: string
  total_minor: string
  currency: string
  created_at: string
  paid_at: string | null
  customer_email: string
  customer_phone: string | null
  shipping_address_id: number | null
  notes: string | null
}

type OrderItemRow = {
  id: number
  variant_id: number | null
  bundle_id: number | null
  quantity: number
  unit_price_minor: string
  line_total_minor: string
}

type AddressRow = {
  recipient_name: string
  phone: string
  street_line_1: string
  street_line_2: string | null
  city: string
  region: string | null
  postal_code: string | null
  country_code: string
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect(`/login?next=/account/orders/${params.id}`)

  const orderId = Number(params.id)
  if (!Number.isFinite(orderId) || orderId <= 0) notFound()

  const orderRes = await supabase
    .from('orders')
    .select(
      'id, order_number, status, kind, subtotal_minor, shipping_minor, tax_minor, discount_minor, total_minor, currency, created_at, paid_at, customer_email, customer_phone, shipping_address_id, notes',
    )
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle()

  const order = (orderRes.data as OrderRow | null) ?? null
  if (!order) notFound()

  // Item rows — also RLS-scoped by order_items_self_read (depends on owning order)
  const itemsRes = await supabase
    .from('order_items')
    .select('id, variant_id, bundle_id, quantity, unit_price_minor, line_total_minor')
    .eq('order_id', orderId)
    .order('id')
  const items = (itemsRes.data ?? []) as OrderItemRow[]

  // Resolve names for the items via service client so deactivated rows still display
  const service = createServiceClient()
  const variantIds = items
    .map((i) => i.variant_id)
    .filter((x): x is number => x !== null)
  const bundleIds = items
    .map((i) => i.bundle_id)
    .filter((x): x is number => x !== null)

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
    id: number
    sku: string
    size_ml: number
    product_id: number
  }>
  const bundles = (bundlesRes.data ?? []) as Array<{
    id: number
    name: string
    slug: string
  }>

  // Pull product names for the variant rows
  const productIds = Array.from(new Set(variants.map((v) => v.product_id)))
  const productsRes = productIds.length
    ? await service.from('products').select('id, name, slug').in('id', productIds)
    : { data: [] as Array<{ id: number; name: string; slug: string }> }
  const products = (productsRes.data ?? []) as Array<{
    id: number
    name: string
    slug: string
  }>

  // Shipping address (if any)
  let address: AddressRow | null = null
  if (order.shipping_address_id) {
    const addrRes = await service
      .from('addresses')
      .select(
        'recipient_name, phone, street_line_1, street_line_2, city, region, postal_code, country_code',
      )
      .eq('id', order.shipping_address_id)
      .maybeSingle()
    address = (addrRes.data as AddressRow | null) ?? null
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <Link
        href="/account/orders"
        className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
      >
        ← All orders
      </Link>

      <header className="mt-4 mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl">{order.order_number}</h1>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Placed{' '}
            {new Date(order.created_at).toLocaleString('en-KE', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <span className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]">
          {order.status}
        </span>
      </header>

      <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
        <ul className="divide-y divide-[hsl(var(--border))]">
          {items.map((item) => {
            const isVariant = item.variant_id !== null
            let label = ''
            if (isVariant) {
              const v = variants.find((x) => x.id === item.variant_id)
              const p = v ? products.find((x) => x.id === v.product_id) : null
              label = p
                ? `${p.name} · ${v?.size_ml ?? ''}ml`
                : `Variant #${item.variant_id ?? ''}`
            } else {
              const b = bundles.find((x) => x.id === item.bundle_id)
              label = b ? b.name : `Bundle #${item.bundle_id ?? ''}`
            }
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-6 px-6 py-4"
              >
                <div>
                  <p className="text-sm">{label}</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {item.quantity} × {formatKes(BigInt(item.unit_price_minor))}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatKes(BigInt(item.line_total_minor))}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <dl className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6 text-sm">
          <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
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
          <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
            <Row label="Total" value={formatKes(BigInt(order.total_minor))} bold />
          </div>
        </dl>

        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6 text-sm">
          <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Shipping
          </h2>
          {address ? (
            <address className="not-italic leading-relaxed">
              <p className="font-medium">{address.recipient_name}</p>
              <p>{address.street_line_1}</p>
              {address.street_line_2 ? <p>{address.street_line_2}</p> : null}
              <p>
                {address.city}
                {address.region ? `, ${address.region}` : ''}
                {address.postal_code ? ` ${address.postal_code}` : ''}
              </p>
              <p>{address.country_code}</p>
              <p className="mt-2 text-[hsl(var(--muted-foreground))]">{address.phone}</p>
            </address>
          ) : (
            <p className="text-[hsl(var(--muted-foreground))]">No shipping address.</p>
          )}
        </div>
      </section>
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
    <div
      className={`flex items-center justify-between py-1.5 ${
        bold ? 'text-base font-medium' : ''
      }`}
    >
      <span className={bold ? '' : 'text-[hsl(var(--muted-foreground))]'}>
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
