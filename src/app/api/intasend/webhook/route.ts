/**
 * POST /api/intasend/webhook — collection events.
 *
 * IntaSend posts here when the lifecycle of an invoice changes. Mandatory
 * verification path:
 *
 *   1. Parse the body as JSON. If unparseable, return 400 (so the call
 *      is not retried).
 *   2. Verify the `challenge` field matches `INTASEND_WEBHOOK_CHALLENGE`
 *      (timing-safe). Mismatch returns 401. The handler does no DB
 *      mutation before this check passes — this is the "missing
 *      verification means full project restart" line from the spec.
 *   3. Validate the rest of the body shape against the Zod schema.
 *   4. Idempotency dedup via `record_webhook_delivery(provider='intasend',
 *      event_id=invoice_id, signature_ok=true)`. If the same invoice has
 *      already been processed, ack 200 and skip.
 *   5. Map IntaSend state → our payments.status. UPDATE the payments row
 *      (already inserted by the collect dispatcher). On `complete`,
 *      call applyPaymentSuccess to run the full chain
 *      (mark_order_paid → provision_distributor → write_commission_ledger
 *      → sendOrderReceipt → audit). On `failed`, mark the payments row
 *      failed and leave the order as-is for the customer to retry.
 *   6. mark_webhook_processed.
 *
 * Idempotency: IntaSend retries on non-2xx. `record_webhook_delivery`
 * UNIQUE(provider, event_id) is the dedup key; `mark_order_paid` is
 * idempotent at the SQL level (short-circuits on already-paid orders).
 *
 * Response: 200 on success or duplicate, 400 on malformed body, 401 on
 * bad challenge, 500 on internal failure (so IntaSend retries us).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyWebhookChallenge } from '@/lib/intasend/signature'
import {
  webhookCollectionSchema,
  intasendStateToPaymentStatus,
} from '@/lib/intasend/types'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // 1. Parse body. We hold the raw text so a forensics dump captures
  //    exactly what IntaSend sent.
  let rawText: string
  try {
    rawText = await req.text()
  } catch {
    return NextResponse.json({ error: 'unreadable body' }, { status: 400 })
  }
  let body: unknown
  try {
    body = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: 'malformed json' }, { status: 400 })
  }

  // 2. Verify challenge BEFORE any DB write. This is the load-bearing
  //    security check — if it ever passes for a forged caller, every
  //    downstream invariant collapses.
  const provided =
    typeof body === 'object' && body !== null && 'challenge' in body
      ? (body as { challenge?: unknown }).challenge
      : undefined
  const verified = verifyWebhookChallenge(
    typeof provided === 'string' ? provided : undefined,
  )
  if (!verified.ok) {
    // eslint-disable-next-line no-console
    console.warn('[intasend/webhook] verification failed:', verified.reason)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 3. Shape validation.
  const parsed = webhookCollectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'malformed payload', detail: parsed.error.message },
      { status: 400 },
    )
  }
  const event = parsed.data

  const service = createServiceClient()

  // The generated database.ts is too narrow for the RPC + payments
  // calls below: `mark_webhook_processed` types `p_error` as
  // `string | undefined`, but we want to pass null (= "no error
  // recorded"); `payments` RPC `p_body` is `Json` which the Zod
  // pass-through schema does not satisfy structurally. Cast through
  // unknown once so the rest of the body stays readable.
  const rpc = (
    service as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }
  ).rpc.bind(service)
  type OrderRow = {
    id: number
    kind: string
    total_minor: string | number
  }

  // 4. Idempotency dedup.
  //    record_webhook_delivery returns TRUE on first insert, FALSE if a
  //    prior row with the same (provider, event_id) already exists. Our
  //    event_id key is the invoice_id; lifecycle transitions for the
  //    same invoice arrive in order from IntaSend, and we want each
  //    transition reflected even if the same `state` retries. So we
  //    compose the event_id as `${invoice_id}:${state}` to dedup
  //    per-transition rather than per-invoice.
  const eventId = `${event.invoice_id}:${event.state}`
  const dedupRes = (await rpc('record_webhook_delivery', {
    p_provider: 'intasend',
    p_event_id: eventId,
    p_event_type: event.state,
    p_signature_ok: true,
    p_body: event,
  })) as { data: boolean | null; error: { message: string } | null }
  if (dedupRes.error) {
    // eslint-disable-next-line no-console
    console.error('[intasend/webhook] dedup failed:', dedupRes.error.message)
    return NextResponse.json(
      { error: 'dedup failed', detail: dedupRes.error.message },
      { status: 500 },
    )
  }
  if (dedupRes.data === false) {
    // Duplicate; ack 200 so IntaSend stops retrying.
    return NextResponse.json({ ok: true, dedup: 'duplicate' })
  }

  // 5. Apply the state transition.
  const mappedStatus = intasendStateToPaymentStatus(event.state)

  // Update the payments row (created by the dispatcher on collect).
  // If it doesn't exist (out-of-band scenarios), we still proceed —
  // applyPaymentSuccess will upsert on the `complete` path.
  await (service.from('payments' as never) as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{
        error: { message: string } | null
      }>
    }
  })
    .update({
      status: mappedStatus,
      raw_payload: event as unknown as Record<string, unknown>,
    })
    .eq('invoice_id', event.invoice_id)

  // 5a. If not yet complete, mark webhook processed and ack.
  if (mappedStatus !== 'complete') {
    await rpc('mark_webhook_processed', {
      p_provider: 'intasend',
      p_event_id: eventId,
      p_error: null,
    })
    return NextResponse.json({ ok: true, status: mappedStatus })
  }

  // 5b. Complete path. Resolve the order via api_ref (preferred — it's
  //     the order_number we sent) or via the payments row.
  let order: OrderRow | null = null
  if (event.api_ref) {
    const r = await service
      .from('orders')
      .select('id, kind, total_minor')
      .eq('order_number', event.api_ref)
      .maybeSingle()
    if (r.data) order = r.data as unknown as OrderRow
  }
  if (!order) {
    const paymentRes = (await (service.from('payments' as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: { order_id: number | null } | null
            error: { message: string } | null
          }>
        }
      }
    })
      .select('order_id')
      .eq('invoice_id', event.invoice_id)
      .maybeSingle()) as {
      data: { order_id: number | null } | null
      error: { message: string } | null
    }
    if (paymentRes.data?.order_id) {
      const r = await service
        .from('orders')
        .select('id, kind, total_minor')
        .eq('id', paymentRes.data.order_id)
        .maybeSingle()
      if (r.data) order = r.data as unknown as OrderRow
    }
  }

  if (!order) {
    // No order resolves — IntaSend sees a payment we have no record of.
    // Ack 200 (no retry will help) but flag so the cron sweeper / admin
    // can investigate. We still mark the dedup row processed with an
    // error string for forensic clarity.
    await rpc('mark_webhook_processed', {
      p_provider: 'intasend',
      p_event_id: eventId,
      p_error: 'no_matching_order',
    })
    return NextResponse.json({ ok: true, status: 'orphan' })
  }

  // 5c. Amount sanity check.
  if (typeof event.value !== 'undefined') {
    const expectedMajor = Math.round(Number(order.total_minor) / 100)
    if (Number(event.value) !== expectedMajor) {
      await rpc('mark_webhook_processed', {
        p_provider: 'intasend',
        p_event_id: eventId,
        p_error: `amount_mismatch:${event.value}!=${expectedMajor}`,
      })
      return NextResponse.json(
        {
          error: 'amount mismatch',
          expected: expectedMajor,
          got: event.value,
        },
        { status: 400 },
      )
    }
  }

  // 5d. Run the canonical post-payment chain.
  const receipt = event.mpesa_reference ?? undefined
  const applied = await applyPaymentSuccess(service, {
    orderId: order.id,
    orderKind: order.kind,
    provider: 'intasend',
    invoiceId: event.invoice_id,
    providerRef: receipt ?? event.invoice_id,
    receipt,
    source: 'webhook',
    rawPayload: event as unknown as Record<string, unknown>,
  })

  await rpc('mark_webhook_processed', {
    p_provider: 'intasend',
    p_event_id: eventId,
    ...(applied.paid ? {} : { p_error: applied.error ?? 'apply_failed' }),
  })

  if (!applied.paid) {
    // Real apply failure — return 500 so IntaSend retries us. The
    // dedup table will allow the retry through because we haven't
    // marked this exact (invoice_id, state) processed without error.
    return NextResponse.json(
      { error: 'apply failed', detail: applied.error },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, status: 'complete' })
}
