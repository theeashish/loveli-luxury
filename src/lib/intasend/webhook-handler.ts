/**
 * IntaSend webhook processing — the piece Phase 2 of the PayHero →
 * IntaSend migration deferred. `signature.ts` (challenge verification)
 * and the `record_webhook_delivery` / `mark_webhook_processed` RPCs
 * (migration 019) were already built for this; this module is the first
 * thing that actually calls them for IntaSend.
 *
 * Discriminates the three webhook kinds by shape (IntaSend doesn't send
 * an explicit `event` type field):
 *   - collection : has `invoice_id` + `state`        (payment-collection-events)
 *   - send_money : has `tracking_id` + `transactions[]` (send-money-events)
 *   - chargeback : has `chargeback_id`                (chargeback-events)
 *
 * SECURITY NOTE on the challenge field: the collection and chargeback
 * webhook doc examples both show a `challenge` field; the send-money doc
 * example does not. Rather than silently trust an unauthenticated
 * send-money (payout) webhook — the single highest-value target for a
 * forged webhook, since it would let an attacker mark a payout
 * "completed" — this handler REQUIRES `challenge` on every kind and
 * rejects (401, not recorded as delivered) if it's absent, even for
 * send_money. If IntaSend's production traffic turns out to omit the
 * challenge on send-money events, that surfaces immediately as 401s in
 * webhook_deliveries rather than as a silently-accepted spoofed payout.
 *
 * Idempotency: `record_webhook_delivery` is the single dedup gate
 * (UNIQUE(provider, event_id)). A duplicate delivery (IntaSend retries
 * up to 5 times over ~init+5min+20min+... per developers.intasend.com/
 * docs/webhooks) returns isNew:false and this module does nothing further
 * — the caller acks 200 either way so IntaSend doesn't keep retrying.
 */

import 'server-only'

import type { createServiceClient } from '../supabase/service'
import type { Json } from '../../types/database'
import { verifyWebhookChallenge } from './signature'
import {
  webhookCollectionSchema,
  webhookSendMoneySchema,
  webhookChargebackSchema,
  intasendStateToPaymentStatus,
} from './types'
import { applyPaymentSuccess } from '../payments/apply-payment-success'
import { WebhookVerificationError } from '../payments/errors'

export type WebhookKind = 'collection' | 'send_money' | 'chargeback' | 'unknown'

export interface ProcessWebhookResult {
  kind: WebhookKind
  isNew: boolean
  applied: boolean
  warnings: string[]
}

type Service = ReturnType<typeof createServiceClient>

function detectKind(body: Record<string, unknown>): WebhookKind {
  if (typeof body.chargeback_id === 'string') return 'chargeback'
  if (typeof body.invoice_id === 'string' && 'state' in body) return 'collection'
  if (typeof body.tracking_id === 'string' && Array.isArray(body.transactions)) return 'send_money'
  return 'unknown'
}

function eventIdFor(kind: WebhookKind, body: Record<string, unknown>): string | null {
  switch (kind) {
    case 'collection':
      return typeof body.invoice_id === 'string' ? body.invoice_id : null
    case 'send_money':
      return typeof body.tracking_id === 'string' ? body.tracking_id : null
    case 'chargeback':
      return typeof body.chargeback_id === 'string' ? body.chargeback_id : null
    default:
      return null
  }
}

/**
 * Process one IntaSend webhook delivery. Throws `WebhookVerificationError`
 * for a missing/invalid challenge or an unparseable body shape — the
 * route handler maps that to 401/400. Anything else (a recognised,
 * verified, but businesslogic-level problem — e.g. the invoice isn't
 * found in `payments`) is captured as a warning and the webhook is still
 * marked processed, matching `applyPaymentSuccess`'s existing
 * non-fatal-warning convention rather than 500ing (a 500 tells IntaSend
 * to retry a webhook that will never resolve differently).
 */
export async function processIntasendWebhook(
  service: Service,
  rawBody: unknown,
): Promise<ProcessWebhookResult> {
  if (typeof rawBody !== 'object' || rawBody === null) {
    throw new WebhookVerificationError('Webhook body is not a JSON object')
  }
  const body = rawBody as Record<string, unknown>
  const kind = detectKind(body)

  if (kind === 'unknown') {
    throw new WebhookVerificationError(
      'Webhook body did not match any known IntaSend event shape (collection/send_money/chargeback)',
    )
  }

  const challenge = typeof body.challenge === 'string' ? body.challenge : undefined
  const verify = verifyWebhookChallenge(challenge)
  const eventId = eventIdFor(kind, body)
  if (!eventId) {
    throw new WebhookVerificationError(`Webhook body of kind "${kind}" is missing its id field`)
  }

  if (!verify.ok) {
    // Still record the delivery attempt (signature_ok=false) for the
    // security audit trail, but do NOT process — and surface a hard
    // error so the route returns 401, not 200.
    await service.rpc('record_webhook_delivery', {
      p_provider: 'intasend',
      p_event_id: eventId,
      p_event_type: kind,
      p_signature_ok: false,
      p_body: body as unknown as Json,
    })
    throw new WebhookVerificationError(`Webhook challenge verification failed: ${verify.reason}`)
  }

  const recordRes = await service.rpc('record_webhook_delivery', {
    p_provider: 'intasend',
    p_event_id: eventId,
    p_event_type: kind,
    p_signature_ok: true,
    p_body: body as unknown as Json,
  })
  const isNew = recordRes.data === true
  if (!isNew) {
    // Verified replay — ack and no-op.
    return { kind, isNew: false, applied: false, warnings: [] }
  }

  const warnings: string[] = []
  let applied = false

  try {
    if (kind === 'collection') {
      applied = await applyCollectionEvent(service, body, warnings)
    } else if (kind === 'send_money') {
      applied = await applySendMoneyEvent(service, body, warnings)
    } else if (kind === 'chargeback') {
      applied = await applyChargebackEvent(service, body, warnings)
    }
  } catch (e) {
    warnings.push((e as Error).message)
  }

  await service.rpc('mark_webhook_processed', {
    p_provider: 'intasend',
    p_event_id: eventId,
    p_error: warnings.length > 0 ? warnings.join('; ') : undefined,
  })

  return { kind, isNew: true, applied, warnings }
}

// -----------------------------------------------------------------------------
// collection (payment) events
// -----------------------------------------------------------------------------

async function applyCollectionEvent(
  service: Service,
  body: Record<string, unknown>,
  warnings: string[],
): Promise<boolean> {
  const parsed = webhookCollectionSchema.safeParse(body)
  if (!parsed.success) {
    warnings.push(`collection webhook body failed schema validation: ${parsed.error.message}`)
    return false
  }
  const event = parsed.data
  const status = intasendStateToPaymentStatus(event.state)

  if (status !== 'complete' && status !== 'failed') {
    // PENDING / PROCESSING — nothing to apply yet; the delivery record
    // (already written) is enough. A later webhook carries the terminal state.
    return false
  }

  // Resolve the order this invoice belongs to via the `payments` row the
  // collect flow wrote at STK-push time.
  const paymentRes = await (
    service.from('payments' as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: { order_id: number | null } | null
            error: { message: string } | null
          }>
        }
      }
    }
  )
    .select('order_id')
    .eq('invoice_id', event.invoice_id)
    .maybeSingle()

  if (paymentRes.error || !paymentRes.data?.order_id) {
    warnings.push(
      `no payments row (or no order_id) found for invoice_id=${event.invoice_id}; cannot apply`,
    )
    return false
  }
  const orderId = paymentRes.data.order_id

  if (status === 'failed') {
    await (
      service.from('payments' as never) as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
        }
      }
    )
      .update({ status: 'failed', raw_payload: event })
      .eq('invoice_id', event.invoice_id)
    return true
  }

  // status === 'complete'
  const orderRes = await (
    service.from('orders' as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: { kind: string } | null
            error: { message: string } | null
          }>
        }
      }
    }
  )
    .select('kind')
    .eq('id', orderId)
    .maybeSingle()

  const orderKind = orderRes.data?.kind ?? 'retail'

  const result = await applyPaymentSuccess(service, {
    orderId,
    orderKind,
    provider: 'intasend',
    invoiceId: event.invoice_id,
    providerRef: event.mpesa_reference ?? event.invoice_id,
    receipt: event.mpesa_reference ?? null,
    source: 'webhook',
    rawPayload: event,
  })
  if (result.error) warnings.push(`applyPaymentSuccess: ${result.error}`)
  warnings.push(...result.warnings)
  return result.paid
}

// -----------------------------------------------------------------------------
// send_money (payout) events
// -----------------------------------------------------------------------------

async function applySendMoneyEvent(
  service: Service,
  body: Record<string, unknown>,
  warnings: string[],
): Promise<boolean> {
  const parsed = webhookSendMoneySchema.safeParse(body)
  if (!parsed.success) {
    warnings.push(`send_money webhook body failed schema validation: ${parsed.error.message}`)
    return false
  }
  const event = parsed.data

  const payoutRes = await (
    service.from('payouts' as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: { id: number; status: string } | null
            error: { message: string } | null
          }>
        }
      }
    }
  )
    .select('id, status')
    .eq('tracking_id', event.tracking_id)
    .maybeSingle()

  if (payoutRes.error || !payoutRes.data) {
    warnings.push(`no payouts row found for tracking_id=${event.tracking_id}`)
    return false
  }
  const payoutId = payoutRes.data.id

  // One payout row == one transaction (see initiateIntasendB2C). Read the
  // first (only) transaction's per-beneficiary outcome — the batch-level
  // `status` ("Completed") only means IntaSend finished processing, not
  // that the individual transfer succeeded.
  const txn = event.transactions?.[0]
  const txnStatus = (txn?.status ?? '').toLowerCase()

  let newStatus: 'completed' | 'failed' | null = null
  if (txnStatus === 'successful') newStatus = 'completed'
  else if (txnStatus === 'failed') newStatus = 'failed'

  if (!newStatus) {
    // Batch still in flight (e.g. "Sending payment") — record only.
    return false
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    raw_payload: event,
  }
  if (newStatus === 'completed') {
    update.completed_at = new Date().toISOString()
  } else {
    update.failure_reason = txn?.status_description ?? 'Transaction failed'
  }

  const updRes = await (
    service.from('payouts' as never) as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .update(update)
    .eq('id', payoutId)
  if (updRes.error) {
    warnings.push(`payouts update failed: ${updRes.error.message}`)
    return false
  }

  await service.from('audit_log').insert({
    actor_id: null,
    action: newStatus === 'completed' ? 'payout.completed.webhook' : 'payout.failed.webhook',
    resource_type: 'payouts',
    resource_id: String(payoutId),
    after_data: {
      tracking_id: event.tracking_id,
      provider_reference: txn?.provider_reference ?? null,
      status: newStatus,
    },
  })

  return true
}

// -----------------------------------------------------------------------------
// chargeback (refund) events
// -----------------------------------------------------------------------------

async function applyChargebackEvent(
  service: Service,
  body: Record<string, unknown>,
  warnings: string[],
): Promise<boolean> {
  const parsed = webhookChargebackSchema.safeParse(body)
  if (!parsed.success) {
    warnings.push(`chargeback webhook body failed schema validation: ${parsed.error.message}`)
    return false
  }
  const event = parsed.data

  // No dedicated refunds table exists yet (out of scope for this pass —
  // the admin refund action handles the order-side state machine
  // synchronously at request time; see `admin/orders/[id]/actions.ts`).
  // The chargeback lifecycle is recorded here for traceability so an
  // operator can correlate a later dispute/reversal against the order.
  await service.from('audit_log').insert({
    actor_id: null,
    action: 'chargeback.status_changed.webhook',
    resource_type: 'chargeback',
    resource_id: event.chargeback_id,
    after_data: {
      status: event.status,
      amount: event.amount ?? null,
      invoice_id: event.invoice?.invoice_id ?? null,
      reason: event.reason ?? null,
      resolution: event.resolution ?? null,
    },
  })
  return true
}
