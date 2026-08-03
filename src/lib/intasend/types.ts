/**
 * Narrow TypeScript shapes for the IntaSend responses we actually consume.
 *
 * The official `intasend-node` SDK types everything as `Promise<any>`
 * (see `node_modules/intasend-node/dist/*.d.ts`). That's safe for the
 * SDK call itself but useless at the application layer — every webhook
 * field, every status check, every B2C transactions array would have to
 * be `any` downstream. So we declare narrow types here, validated with
 * Zod at the trust boundary (the webhook handler), and treat the SDK
 * boundary as untrusted input.
 */

import { z } from 'zod'

// -----------------------------------------------------------------------------
// Collection — mpesaStkPush response
// -----------------------------------------------------------------------------

/**
 * IntaSend STK push response (mpesaStkPush). The fields we care about:
 *   - invoice.invoice_id  → the unique reference we store on payments.invoice_id
 *   - invoice.state       → 'PENDING' immediately after init; lifecycle
 *                           continues via webhook
 *
 * IntaSend may include additional metadata (checkout_id, api_ref, etc.);
 * we don't reject extras, but we don't depend on them either.
 */
export const stkPushResponseSchema = z.object({
  invoice: z.object({
    invoice_id: z.string(),
    state: z.string().optional(),
    api_ref: z.string().optional(),
    net_amount: z.union([z.string(), z.number()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
  }),
  // Catch-all for tracking_id / customer / payment fields IntaSend
  // sometimes emits; preserved into payments.raw_payload but not typed.
}).passthrough()

export type StkPushResponse = z.infer<typeof stkPushResponseSchema>

// -----------------------------------------------------------------------------
// Collection — status
// -----------------------------------------------------------------------------

/**
 * IntaSend collection status response. `state` is the lifecycle marker
 * we map to payments.status:
 *   PENDING / PROCESSING → 'pending' | 'processing'
 *   COMPLETE             → 'complete'
 *   FAILED / RETRY / ... → 'failed'
 */
export const collectionStatusSchema = z.object({
  invoice: z.object({
    invoice_id: z.string(),
    state: z.string(),
    provider: z.string().optional(),
    /** M-Pesa receipt code, when state=COMPLETE and provider=M-PESA. */
    mpesa_reference: z.string().optional().nullable(),
    api_ref: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
    net_amount: z.union([z.string(), z.number()]).optional(),
    failed_reason: z.string().optional().nullable(),
  }),
}).passthrough()

export type CollectionStatus = z.infer<typeof collectionStatusSchema>

/**
 * Map an IntaSend `state` string to our internal payments.status enum.
 * Anything we don't recognise is treated as 'pending' so we never
 * accidentally flip an order paid on an unknown state.
 */
export function intasendStateToPaymentStatus(
  state: string | undefined,
): 'pending' | 'processing' | 'complete' | 'failed' {
  switch ((state ?? '').toUpperCase()) {
    case 'COMPLETE':
    case 'PAID':
      return 'complete'
    case 'FAILED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'failed'
    case 'PROCESSING':
      return 'processing'
    default:
      return 'pending'
  }
}

// -----------------------------------------------------------------------------
// Webhook event body
// -----------------------------------------------------------------------------

/**
 * IntaSend webhook payload — collection events.
 *
 * Verification (mandatory): the `challenge` field must equal the value of
 * the `INTASEND_WEBHOOK_CHALLENGE` env var, which is the same secret set
 * in the IntaSend dashboard's webhook configuration. Anyone who can read
 * this secret can post forged webhooks, so it lives in Vercel/Supabase
 * secrets and never in client code.
 *
 * `invoice_id` is the dedup key (same as collect's response); the
 * webhook_deliveries UNIQUE(provider, event_id) keeps replays idempotent.
 */
export const webhookCollectionSchema = z.object({
  challenge: z.string(),
  invoice_id: z.string(),
  state: z.string(),
  provider: z.string().optional(),
  api_ref: z.string().optional().nullable(),
  mpesa_reference: z.string().optional().nullable(),
  value: z.union([z.string(), z.number()]).optional(),
  net_amount: z.union([z.string(), z.number()]).optional(),
  failed_reason: z.string().optional().nullable(),
  customer: z
    .object({
      phone_number: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      first_name: z.string().optional().nullable(),
      last_name: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
}).passthrough()

export type WebhookCollection = z.infer<typeof webhookCollectionSchema>

/**
 * IntaSend webhook payload — send-money (payout) events.
 *
 * CORRECTED against the official docs (developers.intasend.com/docs/
 * send-money-events, verified 2026-07-26): the batch-level field is
 * named `status` (e.g. "Completed"), NOT `state` — the original
 * speculative schema here used `state`, which would have silently
 * failed to match every real webhook (Zod would still parse it via
 * `.passthrough()`, but `status` would land in the untyped catch-all
 * and any dedup/apply logic reading `.state` would see `undefined`).
 * The dedup key is `tracking_id` (batch-level), and per-beneficiary
 * outcomes live in `transactions[]` keyed by `status` (e.g.
 * "Successful" / "Failed"), NOT the batch's own status.
 *
 * The docs' example payload does not show a `challenge` field (unlike
 * the collection and chargeback examples, which do). The webhook setup
 * page states the challenge applies to webhooks generally with no
 * per-event-type carve-out, so `challenge` is modelled as optional here
 * and the handler logs (rather than silently accepts) a send-money
 * event that arrives without one — see `webhook-handler.ts`.
 */
export const webhookSendMoneySchema = z.object({
  challenge: z.string().optional(),
  file_id: z.string().optional(),
  tracking_id: z.string(),
  batch_reference: z.string().optional().nullable(),
  status: z.string(),
  status_code: z.string().optional(),
  transactions: z
    .array(
      z.object({
        transaction_id: z.string().optional(),
        status: z.string().optional(),
        status_code: z.string().optional(),
        status_description: z.string().optional().nullable(),
        request_reference_id: z.string().optional(),
        provider: z.string().optional(),
        account: z.string().optional(),
        provider_reference: z.string().optional().nullable(),
        amount: z.union([z.string(), z.number()]).optional(),
        charge: z.union([z.string(), z.number()]).optional(),
        narrative: z.string().optional().nullable(),
      }).passthrough(),
    )
    .optional(),
  actual_charges: z.union([z.string(), z.number()]).optional(),
  paid_amount: z.union([z.string(), z.number()]).optional(),
  failed_amount: z.union([z.string(), z.number()]).optional(),
  total_amount: z.union([z.string(), z.number()]).optional(),
  transactions_count: z.number().optional(),
}).passthrough()

export type WebhookSendMoney = z.infer<typeof webhookSendMoneySchema>

/** @deprecated Renamed to `webhookSendMoneySchema` to match the corrected field names. Kept as an alias so any external import doesn't hard-break. */
export const webhookPayoutSchema = webhookSendMoneySchema
/** @deprecated see `webhookSendMoneySchema` */
export type WebhookPayout = WebhookSendMoney

/**
 * IntaSend webhook payload — chargeback (refund) events. Verified
 * against developers.intasend.com/docs/chargeback-events. Dedup key is
 * `chargeback_id`; the nested `invoice` carries the original
 * transaction's `invoice_id` for correlation back to `payments`.
 */
export const webhookChargebackSchema = z.object({
  challenge: z.string(),
  chargeback_id: z.string(),
  status: z.string(),
  amount: z.union([z.string(), z.number()]).optional(),
  reason: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  invoice: z
    .object({
      invoice_id: z.string(),
      state: z.string().optional(),
      api_ref: z.string().optional().nullable(),
    })
    .passthrough()
    .optional(),
}).passthrough()

export type WebhookChargeback = z.infer<typeof webhookChargebackSchema>
