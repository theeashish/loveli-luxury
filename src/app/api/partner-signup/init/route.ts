/**
 * POST /api/partner-signup/init
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
 *
 * IDEMPOTENCY (added in migration 021):
 *   The provider charges the merchant wallet per STK push attempt. Two
 *   inits for the same user = two charges. To prevent this, on every
 *   call we look for an existing pending distributor_signup order for
 *   the user.
 *     - If one exists and is < STALE_PENDING_MS old, we REUSE it: refire
 *       the STK push against the same order_number, update the phone if
 *       the user typed a different one, and return the existing order.
 *     - If one exists and is older, we mark it 'expired' so the partial
 *       unique index releases its slot, then fall through to create a
 *       fresh order with the new submission details.
 *   The DB-level guard is `idx_orders_one_pending_signup_per_user` from
 *   migration 021 — even if the lookup misses (race), the insert will
 *   fail cleanly with a unique-violation rather than create a duplicate.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { initiatePayment } from '@/lib/payments/dispatcher'
import { computeProcessingFeeMinor } from '@/lib/payments/fees'
import {
  decidePendingAction,
  shouldRefireStk,
} from '@/lib/payments/idempotency'
import { checkRateLimit, clientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** How long a pending order is considered "still live" for reuse on a
 *  resubmission. The Daraja STK push itself expires at 60s; 15 min
 *  covers realistic "I wandered off and came back" UX without
 *  indefinitely blocking the user from signing up if they abandon
 *  entirely. */
const STALE_PENDING_MS = 15 * 60 * 1000

/** Daraja STK push expires at 60s on the customer's phone. Within
 *  that window, the previous prompt is still live — refiring would
 *  incur a second provider wallet fee for no UX gain. The init reuse
 *  branch consults this throttle to skip the refire when the prior
 *  push hasn't aged out yet. The explicit /api/intasend/retry-stk
 *  endpoint deliberately ignores this throttle — it only fires after
 *  the panel's 75s timeout, by which point the previous STK is dead. */
const STK_REFIRE_THROTTLE_MS = 60 * 1000

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
  // Rate limit (fail-open; no-op until UPSTASH_* is configured).
  const rl = await checkRateLimit('partner-signup-init', clientIp(req), { limit: 3, windowSeconds: 60 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests — please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

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
        redirect: '/account/partner',
      },
      { status: 409 },
    )
  }

  // 4. Profile lookup — hoisted from later in the flow so the idempotency
  //    reuse branch (below) can call initiatePayment without a second
  //    round-trip.
  const profileRes = await service
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()
  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 500 })
  }
  const profile = profileRes.data as { email: string; full_name: string }

  // 5. Idempotency guard. See file-header comment for the contract.
  //    Look up the user's most recent pending distributor_signup. If
  //    one exists and is fresh, refire STK push and return same order.
  //    If stale, mark expired here so the partial unique index
  //    (idx_orders_one_pending_signup_per_user) doesn't reject the
  //    fresh insert below.
  const existingPendingRes = await service
    .from('orders')
    .select(
      'id, order_number, total_minor, customer_phone, created_at',
    )
    .eq('user_id', user.id)
    .eq('kind', 'distributor_signup')
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
    // REUSE: same order, same external reference → no second provider
    // wallet fee, no second webhook row, no second DB order.
    if (existingPending.customer_phone !== body.customerPhone) {
      const phoneUpdate = await (service.from('orders') as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (col: string, val: unknown) => Promise<{
            error: { message: string } | null
          }>
        }
      })
        .update({ customer_phone: body.customerPhone })
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

    // Refire throttle: if the previous STK push is still alive on
    // the customer's phone (< 60s old), skip the refire to avoid a
    // duplicate provider wallet fee. The panel keeps polling /status
    // and will catch the original prompt's completion.
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
        provider: 'intasend',
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
          phone: body.customerPhone,
        },
        description: `Starter package signup (retry ${existingPending.order_number})`,
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
    // Free the partial-unique-index slot before creating fresh.
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

  // 6. Sponsor — REQUIRED. Resolve and verify active.
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

  // 7. Starter bundle lookup (server-derived; client just sends id)
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
        retail_price_minor: string | number
        distributor_price_minor: string | number
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

  // 8. Resolve shipping address (existing or new)
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

  // 9. Order number
  const onRes = await service.rpc('generate_order_number')
  if (onRes.error || !onRes.data) {
    return NextResponse.json({ error: 'Order number generation failed' }, { status: 500 })
  }
  const orderNumber = onRes.data as unknown as string

  // 10. Joining fee (Phase 7 strictness: "MUST pay to access").
  //     Look up the active config_starter_packages row for the chosen
  //     bundle. If admin has not configured one, the joining fee is 0 —
  //     the starter bundle's retail price is then the total. When admin
  //     seeds a fee, it is added on top of the bundle.
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
  // Add the provider processing fee on top — passed through to the
  // customer, deducted by the provider from settlement.
  const processingFeeMinor = computeProcessingFeeMinor(subtotalMinor)
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
          error: { message: string; code?: string } | null
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
      payment_provider: 'intasend',
      notes: JSON.stringify(signupBlob),
    })
    .select('id, order_number')
    .single()) as {
    data: { id: number; order_number: string } | null
    error: { message: string; code?: string } | null
  }
  if (orderInsert.error || !orderInsert.data) {
    // Unique-violation on idx_orders_one_pending_signup_per_user means
    // a concurrent init created one between our lookup and our insert.
    // Tell the client to retry — its next attempt will hit the reuse
    // branch above.
    if (orderInsert.error?.code === '23505') {
      return NextResponse.json(
        {
          error:
            'Another signup attempt is already in flight. Please retry in a moment.',
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

  // 11. Single line item: the starter bundle. Commission basis (PV) is
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

  // 12. Initiate payment via the current provider (IntaSend STK push).
  //     Phase 0 (2026-06-03): the dispatcher throws — IntaSend wires in
  //     Phase 1. Signup orders sit in 'pending' until then.
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
