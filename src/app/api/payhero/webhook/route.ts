/**
 * POST /api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>
 *
 * PayHero delivers a callback for every STK push attempt — success,
 * failure, cancellation, timeout. This route is the ONLY trusted source
 * of payment confirmation. The frontend's polling against /status is a
 * UX read; it never flips order state.
 *
 * Security model:
 *   1. URL-token gate — PayHero doesn't sign webhooks. The callback URL
 *      we register with PayHero includes ?key=<secret>; this route
 *      timing-safe-compares it against PAYHERO_WEBHOOK_TOKEN.
 *   2. webhook_deliveries dedup table — replay-safe (UNIQUE constraint).
 *   3. mark_order_paid RPC is idempotent on order state.
 *
 * Always return 200 once we've recognised the order, even on duplicate
 * delivery. Non-2xx makes PayHero retry; we only want retries on real
 * infrastructure errors (not "this is a duplicate" or "this order is
 * already settled").
 *
 * Callback body is FLAT (no `response` wrapper) per PayHero docs.
 */

import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  verifyWebhookToken,
  deriveEventId,
} from '@/lib/payhero/service'
import {
  type PayHeroCallback,
  isSuccessfulCallback,
  isFailedCallback,
} from '@/lib/payhero/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET handler for webhook URL-validation pings. Some providers (and
 * humans pasting the URL into a browser) hit this with GET. Return a
 * cheap 200 so URL validators accept the endpoint as reachable.
 * Real webhook deliveries are POST and use the handler below.
 */
export async function GET(req: NextRequest) {
  const receivedKey = req.nextUrl.searchParams.get('key')
  const keyOk = verifyWebhookToken(receivedKey)
  // Diagnostic info — never includes the secret itself, just metadata
  // that lets us tell which check is failing.
  let envTokenSet = false
  let envTokenLength = 0
  try {
    const { getServerEnv } = await import('@/lib/env')
    const env = getServerEnv()
    envTokenSet = !!env.PAYHERO_WEBHOOK_TOKEN
    envTokenLength = env.PAYHERO_WEBHOOK_TOKEN?.length ?? 0
  } catch {
    /* ignore */
  }
  return NextResponse.json({
    ok: true,
    hint: 'POST your payment callback here',
    tokenAccepted: keyOk,
    debug: {
      receivedKeyLength: receivedKey?.length ?? 0,
      envTokenSet,
      envTokenLength,
      lengthsMatch: (receivedKey?.length ?? 0) === envTokenLength,
    },
  })
}

export async function POST(req: NextRequest) {
  // 1. URL-token gate. PayHero registered our callback URL with the
  // token embedded as ?key=…; without it, this request didn't come
  // from PayHero (or came from someone who doesn't know the URL).
  const receivedKey = req.nextUrl.searchParams.get('key')
  const tokenOk = receivedKey ? verifyWebhookToken(receivedKey) : false

  // 2. Read body once
  const rawBody = await req.text()

  let payload: PayHeroCallback
  try {
    payload = JSON.parse(rawBody) as PayHeroCallback
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!payload || typeof payload.status !== 'string' || !payload.external_reference) {
    return NextResponse.json({ error: 'malformed payload' }, { status: 400 })
  }

  const eventId = deriveEventId(payload)
  const externalRef = payload.external_reference
  const eventType = payload.status
  const service = createServiceClient()

  // 3. Dedup. If we've seen this event id before, ack and skip.
  const dedupRes = (await service.rpc('record_webhook_delivery' as never, {
    p_provider: 'payhero',
    p_event_id: eventId,
    p_event_type: eventType,
    p_signature_ok: tokenOk,
    p_body: payload as unknown as Record<string, unknown>,
  } as never)) as { data: boolean | null; error: { message: string } | null }

  if (dedupRes.error) {
    return NextResponse.json(
      { error: 'webhook dedup failed', detail: dedupRes.error.message },
      { status: 500 },
    )
  }
  if (dedupRes.data !== true) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  // 4. Token must be valid. We deliberately recorded the delivery first
  // so an attacker leaves an audit trail.
  if (!tokenOk) {
    await markProcessed(service, eventId, 'invalid url token')
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  // 5. Find the order
  const orderRes = await service
    .from('orders')
    .select('id, status, total_minor, kind, paid_at, payment_provider')
    .eq('order_number', externalRef)
    .maybeSingle()

  if (orderRes.error || !orderRes.data) {
    await markProcessed(
      service,
      eventId,
      orderRes.error
        ? `order lookup failed: ${orderRes.error.message}`
        : `unknown order ${externalRef}`,
    )
    return NextResponse.json({ ok: true, unknown: true })
  }
  const order = orderRes.data

  // 6. Non-success → record and ack, no state change
  if (!isSuccessfulCallback(payload)) {
    await markProcessed(
      service,
      eventId,
      isFailedCallback(payload)
        ? `non-success: ${payload.status}`
        : `intermediate: ${payload.status}`,
    )
    return NextResponse.json({ ok: true, status: payload.status })
  }

  // 7. Amount sanity check (if PayHero supplied it). When the field is
  // missing or null in the callback (some PayHero accounts omit it for
  // STK responses), skip this check and trust order state.
  if (typeof payload.amount === 'number') {
    const expectedMajor = Math.round(Number(order.total_minor) / 100)
    if (payload.amount !== expectedMajor) {
      await markProcessed(
        service,
        eventId,
        `amount mismatch: expected ${expectedMajor}, got ${payload.amount}`,
      )
      return NextResponse.json(
        { error: 'amount mismatch', expected: expectedMajor, received: payload.amount },
        { status: 400 },
      )
    }
  }

  // 8. Stamp the PayHero-specific refs on the order.
  // TODO(types): regenerate database.ts post-migration-019.
  const mpesaReceipt =
    payload.provider_reference ?? payload.third_party_reference ?? null
  await (service.from('orders') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
    }
  })
    .update({
      payhero_external_reference: externalRef,
      payhero_mpesa_receipt: mpesaReceipt,
    })
    .eq('id', order.id)

  // 9. The idempotent state machine: mark_order_paid → (signup ?
  // provision_distributor) → write_commission_ledger.
  try {
    const paidAt = new Date().toISOString()
    const markRes = (await service.rpc('mark_order_paid', {
      p_order_id: order.id,
      p_provider_ref: mpesaReceipt ?? payload.reference ?? eventId,
      p_paid_at: paidAt,
    })) as { error: { message: string } | null }
    if (markRes.error) throw new Error(`mark_order_paid: ${markRes.error.message}`)

    if (order.kind === 'distributor_signup') {
      const provRes = (await service.rpc('provision_distributor', {
        p_order_id: order.id,
      })) as { error: { message: string } | null }
      if (provRes.error) throw new Error(`provision_distributor: ${provRes.error.message}`)
    }

    const ledgerRes = (await service.rpc('write_commission_ledger', {
      p_order_id: order.id,
    })) as { error: { message: string } | null }
    if (ledgerRes.error) {
      await markProcessed(
        service,
        eventId,
        `commission_ledger non-fatal: ${ledgerRes.error.message}`,
      )
      revalidatePath('/shop')
      return NextResponse.json({ ok: true, commissionPending: true })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await markProcessed(service, eventId, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await markProcessed(service, eventId, null)
  revalidatePath('/shop')
  return NextResponse.json({ ok: true })
}

async function markProcessed(
  service: ReturnType<typeof createServiceClient>,
  eventId: string,
  error: string | null,
): Promise<void> {
  await service.rpc('mark_webhook_processed' as never, {
    p_provider: 'payhero',
    p_event_id: eventId,
    p_error: error,
  } as never)
}
