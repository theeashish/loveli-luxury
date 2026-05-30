import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { formatKes } from '@/lib/money'

// NOTE: `resend` and `@/lib/env` are imported lazily inside sendOrderReceipt.
// Importing env at the top eagerly validates env vars, which would break the
// unit test that imports the pure renderReceiptHtml. The webhook uses the same
// dynamic-import pattern for env.

type Service = SupabaseClient<Database>

export type ReceiptItem = { name: string; quantity: number; lineTotalMinor: bigint }
export type ReceiptData = {
  orderNumber: string
  customerName: string | null
  totalMinor: bigint
  items: ReceiptItem[]
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

/** PURE: render the receipt email HTML. No I/O — unit-tested. */
export function renderReceiptHtml(data: ReceiptData, appUrl: string): string {
  const greeting = data.customerName ? `Hi ${escapeHtml(data.customerName)},` : 'Hi,'
  const rows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#333">${escapeHtml(i.name)} &times; ${i.quantity}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#333">${formatKes(i.lineTotalMinor)}</td></tr>`,
    )
    .join('')
  const trackUrl = `${appUrl.replace(/\/+$/, '')}/track/${encodeURIComponent(data.orderNumber)}`
  return `<!doctype html><html><body style="margin:0;background:#faf8f5">
<div style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="letter-spacing:.3em;text-transform:uppercase;font-size:11px;color:#a07c3f;margin:0 0 8px">Loveli Luxury</p>
  <h1 style="font-size:22px;font-weight:500;margin:0 0 16px">Your order is confirmed</h1>
  <p style="margin:0 0 12px">${greeting}</p>
  <p style="margin:0 0 16px">Thank you — we&rsquo;ve received your payment for <strong>${escapeHtml(data.orderNumber)}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
    <tr><td style="padding:10px 0;border-top:1px solid #e3ddd3"><strong>Total paid</strong></td>
        <td style="padding:10px 0;border-top:1px solid #e3ddd3;text-align:right"><strong>${formatKes(data.totalMinor)}</strong></td></tr>
  </table>
  <p style="margin:20px 0 8px;font-size:14px">Track your order: <a href="${trackUrl}" style="color:#a07c3f">${escapeHtml(data.orderNumber)}</a></p>
  <p style="color:#888;font-size:12px;margin:16px 0 0">Every fragrance is authenticity verified before dispatch.</p>
</div></body></html>`
}

async function loadReceiptData(
  service: Service,
  orderId: number,
): Promise<{ to: string; data: ReceiptData } | null> {
  const orderRes = await service
    .from('orders')
    .select('order_number, customer_email, status, total_minor, user_id')
    .eq('id', orderId)
    .maybeSingle()
  const order = orderRes.data as
    | {
        order_number: string
        customer_email: string | null
        status: string
        total_minor: number | string
        user_id: string | null
      }
    | null
  if (!order || order.status !== 'paid' || !order.customer_email) return null

  let customerName: string | null = null
  if (order.user_id) {
    const profRes = await service
      .from('profiles')
      .select('full_name')
      .eq('id', order.user_id)
      .maybeSingle()
    customerName = (profRes.data as { full_name: string | null } | null)?.full_name ?? null
  }

  const itemsRes = await service
    .from('order_items')
    .select('quantity, line_total_minor, variant_id, bundle_id')
    .eq('order_id', orderId)
  const itemRows = (itemsRes.data ?? []) as Array<{
    quantity: number
    line_total_minor: number | string
    variant_id: number | null
    bundle_id: number | null
  }>

  const bundleIds = [...new Set(itemRows.map((r) => r.bundle_id).filter((x): x is number => x != null))]
  const variantIds = [...new Set(itemRows.map((r) => r.variant_id).filter((x): x is number => x != null))]

  const bundleNames = new Map<number, string>()
  if (bundleIds.length) {
    const bRes = await service.from('bundles').select('id, name').in('id', bundleIds)
    for (const b of (bRes.data ?? []) as Array<{ id: number; name: string }>) bundleNames.set(b.id, b.name)
  }

  const variantLabels = new Map<number, string>()
  if (variantIds.length) {
    const vRes = await service
      .from('product_variants')
      .select('id, size_ml, product_id')
      .in('id', variantIds)
    const variants = (vRes.data ?? []) as Array<{ id: number; size_ml: number | null; product_id: number }>
    const productIds = [...new Set(variants.map((v) => v.product_id))]
    const productNames = new Map<number, string>()
    if (productIds.length) {
      const pRes = await service.from('products').select('id, name').in('id', productIds)
      for (const p of (pRes.data ?? []) as Array<{ id: number; name: string }>) productNames.set(p.id, p.name)
    }
    for (const v of variants) {
      const pname = productNames.get(v.product_id) ?? 'Fragrance'
      variantLabels.set(v.id, v.size_ml ? `${pname} ${v.size_ml}ml` : pname)
    }
  }

  const items: ReceiptItem[] = itemRows.map((r) => ({
    name:
      r.bundle_id != null
        ? bundleNames.get(r.bundle_id) ?? 'Onboarding kit'
        : r.variant_id != null
          ? variantLabels.get(r.variant_id) ?? 'Fragrance'
          : 'Item',
    quantity: r.quantity,
    lineTotalMinor: BigInt(r.line_total_minor),
  }))

  return {
    to: order.customer_email,
    data: {
      orderNumber: order.order_number,
      customerName,
      totalMinor: BigInt(order.total_minor),
      items,
    },
  }
}

/**
 * Send an order-confirmation receipt. NON-FATAL by construction — the entire
 * body is wrapped in try/catch and it never throws, so a failed or
 * unconfigured email can never break the payment path. No-op unless both
 * RESEND_API_KEY and RESEND_FROM_EMAIL are set.
 */
export async function sendOrderReceipt(service: Service, orderId: number): Promise<void> {
  try {
    const { getServerEnv, publicEnv } = await import('@/lib/env')
    const env = getServerEnv()
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return

    const loaded = await loadReceiptData(service, orderId)
    if (!loaded) return

    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)
    const res = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: loaded.to,
      subject: `Order ${loaded.data.orderNumber} confirmed — Loveli Luxury`,
      html: renderReceiptHtml(loaded.data, publicEnv.NEXT_PUBLIC_APP_URL),
    })
    if (res.error) {
      console.error('[receipt] resend error', orderId, res.error)
      return
    }
    await service.from('audit_log').insert({
      action: 'email.receipt_sent',
      resource_type: 'orders',
      resource_id: String(orderId),
      after_data: { to: loaded.to, order_number: loaded.data.orderNumber },
    })
  } catch (err) {
    console.error('[receipt] send failed', orderId, err)
  }
}
