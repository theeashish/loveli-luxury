/**
 * Provider-agnostic payment interface.
 *
 * This is the seam a future second provider plugs into. Business logic
 * (checkout, admin payouts, admin refunds, cron sweep) must depend on
 * this interface — via `getPaymentProvider()` in `payment-service.ts` —
 * and never import `intasend-node` or any provider SDK directly.
 *
 * IMPORTANT — this interface is a wrapper, not a rewrite:
 * `IntaSendProvider` (see `intasend-provider.ts`) implements this by
 * delegating collection init + the post-success chain to the existing,
 * already-tested `src/lib/payments/dispatcher.ts` and
 * `src/lib/payments/apply-payment-success.ts` modules. Nothing that
 * already worked was rewritten; this interface just gives it a name a
 * second provider could also answer to.
 */

export type SupportedProvider = 'intasend'

// -----------------------------------------------------------------------------
// initializePayment
// -----------------------------------------------------------------------------

export interface InitializePaymentInput {
  orderId: number
  orderNumber: string
  /** Whole-shilling KES integer (not minor units) — matches the existing dispatcher contract. */
  amountKes: number
  customer: {
    email: string
    name: string
    /** E.164 phone (+254...). */
    phone: string
  }
  description: string
}

export interface InitializePaymentResult {
  provider: SupportedProvider
  /** Provider's reference for this transaction (IntaSend invoice id). */
  invoiceId?: string
  status?: 'stk_pushed' | 'queued'
}

// -----------------------------------------------------------------------------
// verifyPayment
// -----------------------------------------------------------------------------

export type PaymentState = 'pending' | 'processing' | 'complete' | 'failed'

export interface VerifyPaymentResult {
  provider: SupportedProvider
  invoiceId: string
  state: PaymentState
  /** Settlement reference the customer would recognise (M-Pesa receipt, card auth id). */
  providerRef?: string | null
  mpesaReceipt?: string | null
  failedReason?: string | null
  raw: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// handleWebhook
// -----------------------------------------------------------------------------

export type WebhookKind = 'collection' | 'send_money' | 'chargeback' | 'unknown'

export interface HandleWebhookInput {
  /** Raw request body, already JSON.parsed. Untrusted until verified. */
  body: unknown
}

export interface HandleWebhookResult {
  kind: WebhookKind
  /** True the first time this event is seen; false on a verified replay (caller should ack 200 and no-op). */
  isNew: boolean
  /** True once the side effects (mark_order_paid, payout status update, etc.) were applied. */
  applied: boolean
  /** Non-fatal warnings surfaced from the downstream chain. */
  warnings: string[]
}

// -----------------------------------------------------------------------------
// initiatePayout
// -----------------------------------------------------------------------------

export interface InitiatePayoutInput {
  payoutId: number
  amountKes: number
  /** E.164-adjacent — IntaSend's B2C `account` field wants 254XXXXXXXXX (no leading +). */
  msisdn: string
  beneficiaryName: string
  narrative: string
}

export type PayoutDispatchStatus = 'processing' | 'pending_approval'

export interface InitiatePayoutResult {
  provider: SupportedProvider
  /** Provider's tracking id for this payout batch (payouts.tracking_id). */
  trackingId: string
  status: PayoutDispatchStatus
  /** Full initiate response — persisted to payouts.raw_payload so a later approve() call can replay it. */
  raw: Record<string, unknown>
}

export interface ApprovePayoutInput {
  payoutId: number
  /** The raw response captured from initiatePayout(), replayed verbatim to the approve endpoint. */
  raw: Record<string, unknown>
}

export interface ApprovePayoutResult {
  provider: SupportedProvider
  trackingId: string
  raw: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// refundPayment
// -----------------------------------------------------------------------------

export interface RefundPaymentInput {
  orderId: number
  /** Invoice id of the original transaction (payments.invoice_id). */
  invoiceId: string
  /** Whole-shilling KES integer; must be <= the original settled amount. */
  amountKes: number
  reason: string
  reasonDetails: string
}

export interface RefundPaymentResult {
  provider: SupportedProvider
  /** IntaSend's chargeback id for this refund request. */
  chargebackId: string
  raw: Record<string, unknown>
}

// -----------------------------------------------------------------------------
// The interface
// -----------------------------------------------------------------------------

export interface PaymentProvider {
  readonly name: SupportedProvider

  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>

  verifyPayment(invoiceId: string): Promise<VerifyPaymentResult>

  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>

  initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult>

  approvePayout(input: ApprovePayoutInput): Promise<ApprovePayoutResult>

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>
}
