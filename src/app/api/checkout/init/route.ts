/**
 * POST /api/checkout/init
 *
 * Server-driven checkout initiation. The cart payload from the client is
 * UNTRUSTED and is re-priced + re-validated against the database before any
 * order is written. The order is created in `pending` state with a freshly
 * generated order_number; we hand it to PayHero as the external_reference
 * so both the polling client and the webhook can resolve back to our row.
 *
 * Auth:        Customer must be signed in (we need profiles.email and the
 *              addresses RLS chain).
 * RLS bypass:  Order/order_items writes go through the service-role client
 *              because there is no customer-INSERT policy on orders by design
 *              (clients never write the ledger or its inputs directly).
 *
 * IDEMPOTENCY (added in migration 021):
 *   PayHero charges the merchant wallet per STK push attempt. Two inits
 *   for the same user = two charges. So on every call we look for an
 *   existing pending retail order for the user:
 *     - If one exists and is < STALE_PENDING_MS old, we REUSE it: refire
 *       STK against the same order_number, update phone if it changed,
 *       return the existing order. Cart-line / address / sponsor changes
 *       between attempts are deliberately ignored in the reuse window —
 *       the user's first authoritative checkout wins until it expires.
 *     - If one exists and is older, we mark it 'expired' so the partial
 *       unique index releases the slot, then fall through and build a
 *       fresh order from the new cart.
 *   The DB-level guard is `idx_orders_one_pending_retail_per_user` from
 *   migration 021 — even if the lookup misses (race), the insert will
 *   fail cleanly with a unique-violation rather than create a duplicate.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initiatePayment } from '@/lib/payments/dispatcher'
import { computePayHeroFeeMinor } from '@/lib/payhero/fees'
import {
  decidePendingAction,
  shouldRefireStk,
} from '@/lib/payhero/idempotency'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Window during which a still-pending order is reused rather than
 *  duplicated. See file header for rationale. */
const STALE_PENDING_MS = 15 * 60 * 1000

/** Refire throttle: PayHero STK push expires at 60s on the customer's
 *  phone. Within that window, the previous prompt is still live —
 *  refiring would incur a second wallet fee. The init reuse branch
 *  skips refire when the prior push hasn't aged out. The explicit
 *  /api/payhero/retry-stk endpoint ignores this throttle (it only
 *  fires after the panel's 75s timeout). */
const STK_REFIRE_THROTTLE_MS = 60 * 1000

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

  // 3. Profile lookup — hoisted from later so the idempotency reuse
  //    branch can call initiatePayment without re-fetching.
  const profileRes = await service
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()
  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }
  const profile = profileRes.data as { email: string; full_name: string }

  // 4. Idempotency guard. See file-header comment.
  const existingPendingRes = await service
    .from('orders')
    .select(
      'id, order_number, total_minor, customer_phone, created_at',
    )
    .eq('user_id', user.id)
    .eq('kind', 'retail')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingPendingRes.error) {
    return NextResponse.json(
      {
        error: 'Pending-order lookup failed',
        detail: existingPendingRes.error.message,
      },
      { status: 500 },
    )
  }
  const existingPending = existingPendingRes.data as
    | {
        id: number
        order_number: string
        total_minor: string | number
        customer_phone: string | null
        created_at: string
      }
    | null

  const action = decidePendingAction(existingPending, Date.now(), STALE_PENDING_MS)

  if (action.type === 'reuse' && existingPending) {
    if (existingPending.customer_phone !== customerPhone) {
      const phoneUpdate = await (service.from('orders') as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (col: string, val: unknown) => Promise<{
            error: { message: string } | null
          }>
        }
      })
        .update({ customer_phone: customerPhone })
        .eq('id', existingPending.id)
      if (phoneUpdate.error) {
        return NextResponse.json(
          {
            error: 'Could not update phone on existing order',
            detail: phoneUpdate.error.message,
          },
          { status: 500 },
        )
      }
    }
    // Refire throttle: skip if the previous STK push is still alive.
    const recentStkRes = await service
      .from('payment_attempts')
      .select('attempted_at')
      .eq('order_id', existingPending.id)
      .eq('attempt_type', 'stk_push')
      .order('attempted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const recentStk = recentStkRes.data as
      | { attempted_at: string }
      | null

    if (
      !shouldRefireStk(
        recentStk?.attempted_at ?? null,
        Date.now(),
        STK_REFIRE_THROTTLE_MS,
      )
    ) {
      return NextResponse.json({
        orderId: existingPending.id,
        orderNumber: existingPending.order_number,
        reused: true,
        throttled: true,
        provider: 'payhero',
        status: 'stk_pushed',
      })
    }

    const amountKes = Number(BigInt(existingPending.total_minor) / 100n)
    let reuseResult
    try {
      reuseResult = await initiatePayment({
        orderId: existingPending.id,
        orderNumber: existingPending.order_number,
        amountKes,
        customer: {
          email: profile.email,
          name: profile.full_name,
          phone: customerPhone,
        },
        description: `Order ${existingPending.order_number} (retry)`,
      })
    } catch (e) {
      return NextResponse.json(
        { error: 'Payment provider unavailable', detail: (e as Error).message },
        { status: 502 },
      )
    }
    return NextResponse.json({
      orderId: existingPending.id,
      orderNumber: existingPending.order_number,
      reused: true,
      ...reuseResult,
    })
  }

  if (action.type === 'expire') {
    const expireRes = await (service.from('orders') as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => Promise<{
          error: { message: string } | null
        }>
      }
    })
      .update({ status: 'expired' })
      .eq('id', action.orderId)
    if (expireRes.error) {
      return NextResponse.json(
        {
          error: 'Could not expire prior pending order',
          detail: expireRes.error.message,
        },
        { status: 500 },
      )
    }
  }

  // 5. Resolve shipping address (existing or freshly inserted)
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

  // 6. Server-side re-pricing + inventory check
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

  // 7. Resolve sponsor cookie (Step 5 sets it; tolerate absent)
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

  // 8. Generate order number via RPC
  const orderNumberRes = await service.rpc('generate_order_number')
  if (orderNumberRes.error || !orderNumberRes.data) {
    return NextResponse.json({ error: 'Order number generation failed' }, { status: 500 })
  }
  const orderNumber = orderNumberRes.data as unknown as string

  // 9. Compute the PayHero processing fee from the subtotal and add it
  //    to the total. The customer sees and pays this fee on top of the
  //    cart total; PayHero deducts it from what they remit, so the
  //    business receives the full subtotal.
  const processingFeeMinor = computePayHeroFeeMinor(subtotalMinor)
  const totalMinor = subtotalMinor + processingFeeMinor

  // 10. Insert order. TODO(types): regenerate database.ts post-migration-020
  //     (processing_fee_minor is new).
  const orderInsert = (await (service.from('orders') as unknown as {
    insert: (v: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: number; order_number: string; total_minor: string | number } | null
          error: { message: string; code?: string } | null
        }>
      }
    }
  })
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
      processing_fee_minor: Number(processingFeeMinor),
      total_minor: Number(totalMinor),
      currency: 'KES',
      sponsor_distributor_id: sponsorDistributorId,
      shipping_address_id: resolvedAddressId,
      payment_provider: 'payhero',
    })
    .select('id, order_number, total_minor')
    .single()) as {
    data: { id: number; order_number: string; total_minor: string | number } | null
    error: { message: string; code?: string } | null
  }
  if (orderInsert.error || !orderInsert.data) {
    if (orderInsert.error?.code === '23505') {
      return NextResponse.json(
        {
          error:
            'Another checkout attempt is already in flight. Please retry in a moment.',
        },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'Order creation failed', detail: orderInsert.error?.message },
      { status: 500 },
    )
  }
  const orderId = orderInsert.data.id

  // 11. Insert order_items in one batch
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

  // 12. Initiate payment via the current provider (PayHero STK push).
  const amountKes = Number(totalMinor / 100n)
  let result
  try {
    result = await initiatePayment({
      orderId,
      orderNumber,
      amountKes,
      customer: {
        email: profile.email,
        name: profile.full_name,
        phone: customerPhone,
      },
      description: `Order ${orderNumber}`,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Payment provider unavailable', detail: (e as Error).message },
      { status: 502 },
    )
  }

  return NextResponse.json({
    orderId,
    orderNumber,
    ...result,
  })
}
