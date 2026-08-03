/**
 * IntaSend refund (chargeback) calls.
 *
 * IntaSend's refund product is exposed as the "Chargebacks" API —
 * `intasend.refunds()` in the vendored `intasend-node` SDK maps to
 * `POST /api/v1/chargebacks/` (see node_modules/intasend-node/dist/refunds.js).
 * Fields verified against developers.intasend.com/docs/creating-refunds:
 * `invoice`, `amount`, `reason`, `reason_details`.
 *
 * This replaces the manual-refund note in
 * `/admin/orders/[id]/actions.ts` ("neither exposes a documented refund
 * API in our integration at this time") for IntaSend-provider orders —
 * that comment was accurate for the retired PayHero integration but is
 * now out of date for IntaSend, which does document this endpoint.
 * Historical PayHero orders still fall back to the manual dashboard
 * flow; the admin action branches on `orders.payment_provider`.
 */

import 'server-only'

import { z } from 'zod'
import { getIntasend } from './client'
import { createServiceClient } from '../supabase/service'
import { RefundError, TimeoutError, ValidationError } from '../payments/errors'

const REFUND_CALL_TIMEOUT_MS = 20_000

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${REFUND_CALL_TIMEOUT_MS}ms`)),
      REFUND_CALL_TIMEOUT_MS,
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

async function logRefundAttempt(
  service: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await (
      service.from('payment_attempts' as never) as unknown as {
        insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
    ).insert(row)
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('[intasend/refunds] payment_attempts insert failed:', error.message)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[intasend/refunds] payment_attempts insert skipped:', (e as Error).message)
  }
}

/**
 * Response shape not published in the docs beyond the fact that a
 * chargeback record is created (see chargeback-events.md for the
 * eventual webhook shape, which nests a `chargeback_id`). We require
 * only what we actually depend on (`.passthrough()` for the rest) so a
 * genuine field we haven't seen doesn't fail validation.
 */
const refundResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  chargeback_id: z.string().optional(),
  status: z.string().optional(),
}).passthrough()

export interface CreateRefundArgs {
  orderId: number
  /** Invoice id of the original transaction — payments.invoice_id. */
  invoiceId: string
  amountKes: number
  reason: string
  reasonDetails: string
}

export interface CreateRefundResult {
  /** IntaSend does not document a single canonical id field name in the
   *  create-response; we accept either `chargeback_id` or `id` and
   *  normalise to `chargebackId`, preferring `chargeback_id` since
   *  that's the field the chargeback-events webhook payload uses. */
  chargebackId: string
  raw: Record<string, unknown>
}

export async function createIntasendRefund(args: CreateRefundArgs): Promise<CreateRefundResult> {
  if (!Number.isInteger(args.amountKes) || args.amountKes <= 0) {
    throw new ValidationError('amountKes must be a positive integer')
  }
  if (!args.invoiceId) {
    throw new ValidationError('invoiceId is required to create a refund')
  }

  const service = createServiceClient()
  const intasend = getIntasend()
  const refundsApi = intasend.refunds() as unknown as {
    create: (payload: Record<string, unknown>) => Promise<unknown>
  }

  let raw: unknown
  try {
    raw = await withTimeout(
      'IntaSend refund create',
      refundsApi.create({
        invoice: args.invoiceId,
        amount: String(args.amountKes),
        reason: args.reason,
        reason_details: args.reasonDetails,
      }),
    )
  } catch (e) {
    await logRefundAttempt(service, {
      order_id: args.orderId,
      provider: 'intasend',
      attempt_type: 'refund',
      status: 'error',
      error_message: (e as Error).message,
      request_payload: { invoiceId: args.invoiceId, amountKes: args.amountKes },
    })
    if (e instanceof TimeoutError) throw e
    throw new RefundError(`IntaSend refund create failed: ${(e as Error).message}`, {
      orderId: args.orderId,
      invoiceId: args.invoiceId,
    })
  }

  const parsed = refundResponseSchema.safeParse(raw)
  if (!parsed.success) {
    await logRefundAttempt(service, {
      order_id: args.orderId,
      provider: 'intasend',
      attempt_type: 'refund',
      status: 'failed',
      error_message: `unparseable response: ${parsed.error.message}`,
      response_payload: raw as Record<string, unknown>,
    })
    throw new RefundError(
      `IntaSend returned an unexpected refund response shape: ${parsed.error.message}`,
      { orderId: args.orderId, invoiceId: args.invoiceId },
    )
  }

  const chargebackId = parsed.data.chargeback_id ?? String(parsed.data.id ?? '')
  if (!chargebackId) {
    throw new RefundError(
      'IntaSend refund response contained neither chargeback_id nor id',
      { orderId: args.orderId, invoiceId: args.invoiceId, raw: parsed.data },
    )
  }

  await logRefundAttempt(service, {
    order_id: args.orderId,
    provider: 'intasend',
    attempt_type: 'refund',
    status: 'success',
    request_payload: { invoiceId: args.invoiceId, amountKes: args.amountKes },
    response_payload: parsed.data as Record<string, unknown>,
  })

  return { chargebackId, raw: parsed.data as Record<string, unknown> }
}
