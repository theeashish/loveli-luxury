/**
 * POST /api/distributor-signup/init
 *
 * Distributor onboarding checkout. Differs from /api/checkout/init in three
 * meaningful ways:
 *
 *   1. INVITE-ONLY. A valid, active sponsor code is REQUIRED. The cookie
 *      set by middleware is the primary capture path; the form also accepts
 *      manual entry. Submission without a resolvable code is rejected.
 *      (See memory: feedback_distributor_signup_invite_only.md)
 *
 *   2. The cart is server-derived from a single chosen starter bundle, not
 *      the buyer's Zustand cart. We look up bundles WHERE is_starter_package
 *      = TRUE and use the row's retail price.
 *
 *   3. KYC fields (national_id, dob, payout_msisdn) are stashed into
 *      orders.notes as JSON so the provision_distributor RPC can hydrate
 *      the new distributors row when the order goes paid.
 *
 * Auth:        User must be signed in. Already-distributor users are rejected.
 * RLS bypass:  Order writes use the service-role client (no customer-INSERT
 *              policy on orders by design).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initiatePayment } from '@/lib/payments/dispatcher'
import { computePayHeroFeeMinor } from '@/lib/payhero/fees'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// -----------------------------------------------------------------------------
// Request schema
// -----------------------------------------------------------------------------

const phoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Phone must be E.164 format e.g. +254712345678')

const sponsorCodeSchema = z
  .string()
  .regex(/^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/, 'Sponsor code must look like LL-XX-XXXX')

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
    starterBundleId: z.number().int().positive(),
    sponsorCode: sponsorCodeSchema,
    nationalId: z.string().min(4).max(40),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    payoutMsisdn: phoneSchema,
    agreedToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the distributor terms.' }),
    }),
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

  // 2. Body
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
  const body = parsed.data

  const service = createServiceClient()

  // 3. Already-a-distributor guard. Idempotent UX rather than a 409 to allow
  //    the client to redirect cleanly.
  const existing = await service
    .from('distributors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing.data) {
    return NextResponse.json(
      {
        error: 'You are already a distributor.',
        redirect: '/account/distributor',
      },
      { status: 409 },
    )
  }

  // 4. Sponsor — REQUIRED. Resolve and verify active.
  const sponsorRes = await service
    .from('distributors')
    .select('id, user_id, is_active')
    .eq('sponsor_code', body.sponsorCode)
    .maybeSingle()
  const sponsor = sponsorRes.data as
    | { id: number; user_id: string; is_active: boolean }
    | null
  if (!sponsor || !sponsor.is_active) {
    return NextResponse.json(
      { error: 'Sponsor code not recognised or inactive.' },
      { status: 400 },
    )
  }
  if (sponsor.user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot sponsor yourself.' },
      { status: 400 },
    )
  }

  // 5. Starter bundle lookup (server-derived; client just sends id)
  const bundleRes = await service
    .from('bundles')
    .select(
      'id, name, retail_price_minor, distributor_price_minor, is_active, is_starter_package',
    )
    .eq('id', body.starterBundleId)
    .maybeSingle()
  const bundle = bundleRes.data as
    | {
        id: number
        name: string
        retail_price_minor: string
        distributor_price_minor: string
        is_active: boolean
        is_starter_package: boolean
      }
    | null
  if (!bundle || !bundle.is_active || !bundle.is_starter_package) {
    return NextResponse.json(
      { error: 'Starter package unavailable.' },
      { status: 400 },
    )
  }

  // 6. Resolve shipping address (existing or new)
  let resolvedAddressId: number
  if (body.shippingAddressId !== null) {
    const r = await service
      .from('addresses')
      .select('id, user_id')
      .eq('id', body.shippingAddressId)
      .maybeSingle()
    if (r.error || !r.data || r.data.user_id !== user.id) {
      return NextResponse.json({ error: 'Address not found' }, { status: 400 })
    }
    resolvedAddressId = r.data.id
  } else if (body.newAddress) {
    const ins = await service
      .from('addresses')
      .insert({
        user_id: user.id,
        label: body.newAddress.label ?? null,
        recipient_name: body.newAddress.recipientName,
        phone: body.newAddress.phone,
        street_line_1: body.newAddress.streetLine1,
        street_line_2: body.newAddress.streetLine2 ?? null,
        city: body.newAddress.city,
        region: body.newAddress.region ?? null,
        postal_code: body.newAddress.postalCode ?? null,
        country_code: body.newAddress.countryCode.toUpperCase(),
        is_default: body.newAddress.saveAsDefault ?? false,
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

  // 7. Profile
  const profileRes = await service
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()
  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }
  const profile = profileRes.data

  // 8. Order number
  const onRes = await service.rpc('generate_order_number')
  if (onRes.error || !onRes.data) {
    return NextResponse.json({ error: 'Order number generation failed' }, { status: 500 })
  }
  const orderNumber = onRes.data as unknown as string

  // 9. Joining fee (Phase 7 strictness: "MUST pay to access").
  //    Look up the active config_starter_packages row for the chosen
  //    bundle. If admin has not configured one, the joining fee is 0 —
  //    the starter bundle's retail price is then the total. When admin
  //    seeds a fee, it is added on top of the bundle.
  const fkRes = await service
    .from('config_starter_packages')
    .select('joining_fee_minor')
    .eq('bundle_id', bundle.id)
    .is('effective_until', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  const joiningFeeMinor: bigint = fkRes.data
    ? BigInt(
        (fkRes.data as { joining_fee_minor: string | number }).joining_fee_minor,
      )
    : 0n

  const bundleMinor = BigInt(bundle.retail_price_minor)
  const subtotalMinor = bundleMinor + joiningFeeMinor
  // Add the PayHero processing fee on top — passed through to the
  // customer, deducted by PayHero from settlement.
  const processingFeeMinor = computePayHeroFeeMinor(subtotalMinor)
  const totalMinor = subtotalMinor + processingFeeMinor

  const signupBlob = {
    signup: {
      national_id: body.nationalId,
      date_of_birth: body.dateOfBirth,
      payout_msisdn: body.payoutMsisdn,
      starter_bundle_id: bundle.id,
      sponsor_distributor_id: sponsor.id,
      sponsor_code: body.sponsorCode,
      agreed_to_terms_at: new Date().toISOString(),
      joining_fee_minor: String(joiningFeeMinor),
      starter_bundle_minor: String(bundleMinor),
    },
  }

  // TODO(types): regenerate database.ts post-migration-020.
  const orderInsert = (await (service.from('orders') as unknown as {
    insert: (v: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: number; order_number: string } | null
          error: { message: string } | null
        }>
      }
    }
  })
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      customer_email: profile.email,
      customer_phone: body.customerPhone,
      kind: 'distributor_signup',
      status: 'pending',
      subtotal_minor: String(subtotalMinor),
      shipping_minor: 0,
      tax_minor: 0,
      discount_minor: 0,
      processing_fee_minor: String(processingFeeMinor),
      total_minor: String(totalMinor),
      currency: 'KES',
      sponsor_distributor_id: sponsor.id,
      shipping_address_id: resolvedAddressId,
      payment_provider: 'payhero',
      notes: JSON.stringify(signupBlob),
    })
    .select('id, order_number')
    .single()) as {
    data: { id: number; order_number: string } | null
    error: { message: string } | null
  }
  if (orderInsert.error || !orderInsert.data) {
    return NextResponse.json(
      { error: 'Order creation failed', detail: orderInsert.error?.message },
      { status: 500 },
    )
  }
  const orderId = orderInsert.data.id

  // 10. Single line item: the starter bundle. Commission basis (PV) is
  //     summed from the bundle's component variants × their PV per bottle.
  //     Two-step lookup avoids relying on PostgREST FK introspection.
  const bundleComponentsRes = await service
    .from('bundle_items')
    .select('quantity, variant_id')
    .eq('bundle_id', bundle.id)
  const bundleComponents = (bundleComponentsRes.data ?? []) as Array<{
    quantity: number
    variant_id: number
  }>
  const componentVariantIds = bundleComponents.map((c) => c.variant_id)
  const componentPvRes = componentVariantIds.length
    ? await service
        .from('product_variants')
        .select('id, pv_per_bottle')
        .in('id', componentVariantIds)
    : { data: [] as Array<{ id: number; pv_per_bottle: number }> }
  const pvByVariant = new Map<number, number>(
    ((componentPvRes.data ?? []) as Array<{ id: number; pv_per_bottle: number }>)
      .map((v) => [v.id, v.pv_per_bottle ?? 0]),
  )
  const bundlePv = bundleComponents.reduce(
    (acc, c) => acc + c.quantity * (pvByVariant.get(c.variant_id) ?? 0),
    0,
  )

  const itemsRes = await service.from('order_items').insert([
    {
      order_id: orderId,
      bundle_id: bundle.id,
      variant_id: null,
      quantity: 1,
      unit_price_minor: String(bundle.retail_price_minor),
      line_total_minor: String(bundle.retail_price_minor),
      is_commissionable: true,
      commissionable_amount_minor: String(bundle.distributor_price_minor),
      commission_pv: bundlePv,
    },
  ])
  if (itemsRes.error) {
    await service.from('orders').delete().eq('id', orderId)
    return NextResponse.json(
      { error: 'Order items creation failed', detail: itemsRes.error.message },
      { status: 500 },
    )
  }

  // 11. Initiate payment via the current provider (PayHero STK push or
  // Flutterwave hosted link, dispatched by PAYMENT_PROVIDER_DEFAULT).
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
        phone: body.customerPhone,
      },
      description: `Starter package ${bundle.name}`,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Payment provider unavailable', detail: (e as Error).message },
      { status: 502 },
    )
  }

  return NextResponse.json({ orderId, orderNumber, ...result })
}
