/**
 * POST /api/checkout/init
 *
 * Server-driven checkout initiation. The cart payload from the client is
 * UNTRUSTED and is re-priced + re-validated against the database before any
 * order is written. The order is created in `pending` state with a freshly
 * generated order_number; we hand it to Flutterwave as the tx_ref so both
 * the redirect-return path and the webhook can resolve back to our row.
 *
 * Auth:        Customer must be signed in (we need profiles.email and the
 *              addresses RLS chain).
 * RLS bypass:  Order/order_items writes go through the service-role client
 *              because there is no customer-INSERT policy on orders by design
 *              (clients never write the ledger or its inputs directly).
 * Idempotency: Each call mints a new order_number and a new FW link. If the
 *              user reloads checkout we'll create another pending order — the
 *              previous one stays orphaned at `pending` forever, which is fine.
 *              A nightly job can sweep stale pendings later.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createPaymentLink } from '@/lib/flutterwave/service'
import { publicEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// -----------------------------------------------------------------------------
// Request schema
// -----------------------------------------------------------------------------

const phoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Phone must be E.164 format e.g. +254712345678')

const variantLineSchema = z.object({
  kind: z.literal('variant'),
  variantId: z.number().int().positive(),
  unitPriceMinor: z.string().regex(/^\d+$/),
  qty: z.number().int().min(1).max(99),
})

const bundleLineSchema = z.object({
  kind: z.literal('bundle'),
  bundleId: z.number().int().positive(),
  unitPriceMinor: z.string().regex(/^\d+$/),
  qty: z.number().int().min(1).max(99),
})

const cartLineSchema = z.discriminatedUnion('kind', [variantLineSchema, bundleLineSchema])

const newAddressSchema = z.object({
  label: z.string().max(50).optional().nullable(),
  recipientName: z.string().min(1).max(120),
  phone: phoneSchema,
  streetLine1: z.string().min(1).max(200),
  streetLine2: z.string().max(200).optional().nullable(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  countryCode: z.string().length(2),
  saveAsDefault: z.boolean().optional(),
})

const requestSchema = z
  .object({
    cartId: z.string().min(1),
    lines: z.array(cartLineSchema).min(1).max(50),
    shippingAddressId: z.number().int().positive().nullable(),
    newAddress: newAddressSchema.nullable(),
    customerPhone: phoneSchema,
  })
  .refine((d) => d.shippingAddressId !== null || d.newAddress !== null, {
    message: 'Either an existing address or a new address is required',
    path: ['shippingAddressId'],
  })

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

export async function POST(req: Request) {
  // 1. Auth
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  // 2. Parse body
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = requestSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { lines, shippingAddressId, newAddress, customerPhone } = parsed.data

  const service = createServiceClient()

  // 3. Resolve shipping address (existing or freshly inserted)
  let resolvedAddressId: number
  if (shippingAddressId !== null) {
    const { data, error } = await service
      .from('addresses')
      .select('id, user_id')
      .eq('id', shippingAddressId)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: 'Address lookup failed' }, { status: 500 })
    }
    if (!data || data.user_id !== user.id) {
      return NextResponse.json({ error: 'Address not found' }, { status: 400 })
    }
    resolvedAddressId = data.id
  } else if (newAddress) {
    const ins = await service
      .from('addresses')
      .insert({
        user_id: user.id,
        label: newAddress.label ?? null,
        recipient_name: newAddress.recipientName,
        phone: newAddress.phone,
        street_line_1: newAddress.streetLine1,
        street_line_2: newAddress.streetLine2 ?? null,
        city: newAddress.city,
        region: newAddress.region ?? null,
        postal_code: newAddress.postalCode ?? null,
        country_code: newAddress.countryCode.toUpperCase(),
        is_default: newAddress.saveAsDefault ?? false,
      })
      .select('id')
      .single()
    if (ins.error || !ins.data) {
      return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
    }
    resolvedAddressId = ins.data.id
  } else {
    return NextResponse.json({ error: 'Address required' }, { status: 400 })
  }

  // 4. Server-side re-pricing + inventory check
  const variantIds = lines
    .filter((l): l is z.infer<typeof variantLineSchema> => l.kind === 'variant')
    .map((l) => l.variantId)
  const bundleIds = lines
    .filter((l): l is z.infer<typeof bundleLineSchema> => l.kind === 'bundle')
    .map((l) => l.bundleId)

  const variantsRes = variantIds.length
    ? await service
        .from('product_variants')
        .select('id, retail_price_minor, distributor_price_minor, pv_per_bottle, is_active')
        .in('id', variantIds)
    : { data: [], error: null }
  if (variantsRes.error) {
    return NextResponse.json({ error: 'Variant lookup failed' }, { status: 500 })
  }
  const variants = variantsRes.data ?? []

  const bundlesRes = bundleIds.length
    ? await service
        .from('bundles')
        .select('id, retail_price_minor, distributor_price_minor, is_active')
        .in('id', bundleIds)
    : { data: [], error: null }
  if (bundlesRes.error) {
    return NextResponse.json({ error: 'Bundle lookup failed' }, { status: 500 })
  }
  const bundles = bundlesRes.data ?? []

  const bundleItemsRes = bundleIds.length
    ? await service
        .from('bundle_items')
        .select('bundle_id, variant_id, quantity')
        .in('bundle_id', bundleIds)
    : { data: [], error: null }
  if (bundleItemsRes.error) {
    return NextResponse.json({ error: 'Bundle items lookup failed' }, { status: 500 })
  }
  const bundleItems = bundleItemsRes.data ?? []

  // Bundle items also need each component variant's pv_per_bottle for the
  // PV totalling pass on bundle lines.
  const componentVariantIds = Array.from(
    new Set(bundleItems.map((bi) => bi.variant_id)),
  )
  const componentVariantsRes = componentVariantIds.length
    ? await service
        .from('product_variants')
        .select('id, pv_per_bottle')
        .in('id', componentVariantIds)
    : { data: [], error: null }
  if (componentVariantsRes.error) {
    return NextResponse.json({ error: 'Bundle component PV lookup failed' }, { status: 500 })
  }
  const componentVariants = componentVariantsRes.data ?? []
  const pvByVariant = new Map<number, number>(
    componentVariants.map((v) => [v.id, v.pv_per_bottle ?? 0]),
  )

  // Walk lines, validate, accumulate inventory needs, build order_items rows
  type OrderItemRow = {
    variant_id: number | null
    bundle_id: number | null
    quantity: number
    unit_price_minor: number
    line_total_minor: number
    is_commissionable: boolean
    commissionable_amount_minor: number
    commission_pv: number
  }
  const itemRows: OrderItemRow[] = []
  const requiredVariantQty = new Map<number, number>()
  let subtotalMinor = 0n

  for (const line of lines) {
    if (line.kind === 'variant') {
      const v = variants.find((x) => x.id === line.variantId)
      if (!v || !v.is_active) {
        return NextResponse.json(
          { error: `Variant ${line.variantId} is no longer available.` },
          { status: 409 },
        )
      }
      const expected = BigInt(v.retail_price_minor)
      const claimed = BigInt(line.unitPriceMinor)
      if (expected !== claimed) {
        return NextResponse.json(
          { error: 'Prices have changed. Please review your cart.' },
          { status: 409 },
        )
      }
      requiredVariantQty.set(v.id, (requiredVariantQty.get(v.id) ?? 0) + line.qty)
      const lineTotal = expected * BigInt(line.qty)
      subtotalMinor += lineTotal
      const variantPv = (v as { pv_per_bottle?: number }).pv_per_bottle ?? 0
      itemRows.push({
        variant_id: v.id,
        bundle_id: null,
        quantity: line.qty,
        unit_price_minor: Number(expected),
        line_total_minor: Number(lineTotal),
        is_commissionable: true,
        commissionable_amount_minor: Number(BigInt(v.distributor_price_minor) * BigInt(line.qty)),
        commission_pv: variantPv * line.qty,
      })
    } else {
      const b = bundles.find((x) => x.id === line.bundleId)
      if (!b || !b.is_active) {
        return NextResponse.json(
          { error: `Bundle ${line.bundleId} is no longer available.` },
          { status: 409 },
        )
      }
      const expected = BigInt(b.retail_price_minor)
      const claimed = BigInt(line.unitPriceMinor)
      if (expected !== claimed) {
        return NextResponse.json(
          { error: 'Prices have changed. Please review your cart.' },
          { status: 409 },
        )
      }
      const components = bundleItems.filter((bi) => bi.bundle_id === b.id)
      let bundlePvPerOne = 0
      for (const c of components) {
        requiredVariantQty.set(
          c.variant_id,
          (requiredVariantQty.get(c.variant_id) ?? 0) + line.qty * c.quantity,
        )
        bundlePvPerOne += (pvByVariant.get(c.variant_id) ?? 0) * c.quantity
      }
      const lineTotal = expected * BigInt(line.qty)
      subtotalMinor += lineTotal
      itemRows.push({
        variant_id: null,
        bundle_id: b.id,
        quantity: line.qty,
        unit_price_minor: Number(expected),
        line_total_minor: Number(lineTotal),
        is_commissionable: true,
        commissionable_amount_minor: Number(
          BigInt(b.distributor_price_minor) * BigInt(line.qty),
        ),
        commission_pv: bundlePvPerOne * line.qty,
      })
    }
  }

  // Pre-flight inventory check (final guard is the CHECK constraint inside
  // mark_order_paid; this surfaces a nicer error before a payment is started)
  const allReqIds = Array.from(requiredVariantQty.keys())
  if (allReqIds.length > 0) {
    const inv = await service
      .from('product_variants')
      .select('id, inventory_qty, is_active')
      .in('id', allReqIds)
    if (inv.error) {
      return NextResponse.json({ error: 'Inventory check failed' }, { status: 500 })
    }
    for (const [variantId, needed] of requiredVariantQty) {
      const row = inv.data?.find((r) => r.id === variantId)
      if (!row || !row.is_active) {
        return NextResponse.json(
          { error: 'A bundle component is unavailable.' },
          { status: 409 },
        )
      }
      if (row.inventory_qty < needed) {
        return NextResponse.json(
          { error: 'One of your items is out of stock.' },
          { status: 409 },
        )
      }
    }
  }

  // 5. Resolve sponsor cookie (Step 5 sets it; tolerate absent)
  let sponsorDistributorId: number | null = null
  const sponsorCode = cookies().get('ll_sponsor')?.value
  if (sponsorCode) {
    const r = await service
      .from('distributors')
      .select('id, is_active')
      .eq('sponsor_code', sponsorCode)
      .maybeSingle()
    if (r.data?.is_active) sponsorDistributorId = r.data.id
  }

  // 6. Profile (for customer_email + name)
  const profileRes = await service
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()
  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }
  const profile = profileRes.data

  // 7. Generate order number via RPC
  const orderNumberRes = await service.rpc('generate_order_number')
  if (orderNumberRes.error || !orderNumberRes.data) {
    return NextResponse.json({ error: 'Order number generation failed' }, { status: 500 })
  }
  const orderNumber = orderNumberRes.data as unknown as string

  // 8. Insert order
  const totalMinor = subtotalMinor // shipping/tax/discount = 0 in Phase 3
  const orderInsert = await service
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      customer_email: profile.email,
      customer_phone: customerPhone,
      kind: 'retail',
      status: 'pending',
      subtotal_minor: Number(subtotalMinor),
      shipping_minor: 0,
      tax_minor: 0,
      discount_minor: 0,
      total_minor: Number(totalMinor),
      currency: 'KES',
      sponsor_distributor_id: sponsorDistributorId,
      shipping_address_id: resolvedAddressId,
      payment_provider: 'flutterwave',
    })
    .select('id, order_number, total_minor')
    .single()
  if (orderInsert.error || !orderInsert.data) {
    return NextResponse.json(
      { error: 'Order creation failed', detail: orderInsert.error?.message },
      { status: 500 },
    )
  }
  const orderId = orderInsert.data.id

  // 9. Insert order_items in one batch
  const itemsRes = await service
    .from('order_items')
    .insert(itemRows.map((r) => ({ ...r, order_id: orderId })))
  if (itemsRes.error) {
    // Best-effort: drop the orphan order so it doesn't pollute reporting
    await service.from('orders').delete().eq('id', orderId)
    return NextResponse.json(
      { error: 'Order items creation failed', detail: itemsRes.error.message },
      { status: 500 },
    )
  }

  // 10. Create the Flutterwave hosted-checkout link
  // total_minor is integer cents; FW Charges API uses major units. KES has no
  // sub-shilling pricing in this catalog, so divide cleanly by 100n.
  const amountKes = Number(totalMinor / 100n)
  const redirectUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/checkout/return`

  let link: string
  try {
    const fw = await createPaymentLink({
      txRef: orderNumber,
      amountKes,
      redirectUrl,
      customer: {
        email: profile.email,
        name: profile.full_name,
        phonenumber: customerPhone,
      },
      meta: {
        order_id: orderId,
        user_id: user.id,
      },
      customizations: {
        title: 'Loveli Luxury International',
        description: `Order ${orderNumber}`,
      },
    })
    link = fw.link
  } catch (e) {
    return NextResponse.json(
      { error: 'Payment provider unavailable', detail: (e as Error).message },
      { status: 502 },
    )
  }

  return NextResponse.json({
    orderId,
    orderNumber,
    redirectUrl: link,
  })
}
