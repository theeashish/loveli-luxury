/**
 * PayHero API type shapes — derived from the official PayHero developer
 * docs at https://docs.payhero.co.ke (verified against their JS bundle
 * on cutover day).
 *
 * If PayHero changes a field name, change it HERE — every other file in
 * the integration uses these types and never re-declares raw shapes.
 *
 * Important: callbacks are NOT nested under a `response` key. They are
 * a flat JSON object with mixed casing (`external_reference` snake,
 * `CheckoutRequestID` Pascal). The webhook handler parses this shape
 * directly. There is no HMAC signature header — security relies on a
 * secret token embedded in the callback URL we register with PayHero.
 */

// ---------------------------------------------------------------------
// STK Push initiate — POST /api/v2/payments
// ---------------------------------------------------------------------

export interface StkPushRequest {
  amount: number              // KES whole shillings
  phone_number: string        // 254XXXXXXXXX (no leading +, no leading 0)
  channel_id: number          // PayHero channel id for STK
  provider: 'm-pesa'          // also accepts 'airtel-money' but we use mpesa
  external_reference: string  // our order_number
  customer_name?: string
  callback_url: string
  network_code?: '63902' | '63903' // 63902=MPESA, 63903=Airtel; PayHero infers from phone if omitted
}

export interface StkPushResponse {
  success: boolean
  status: 'QUEUED' | 'FAILED' | string
  reference?: string          // PayHero internal reference
  CheckoutRequestID?: string  // Safaricom CheckoutRequestID (often empty initially)
  message?: string
  error?: string
}

// ---------------------------------------------------------------------
// Inbound webhook (payment callback) — FLAT JSON, not nested
// ---------------------------------------------------------------------

export type PayHeroCallbackStatus = 'SUCCESS' | 'FAILED' | 'QUEUED' | string

export interface PayHeroCallback {
  success: boolean
  status: PayHeroCallbackStatus
  external_reference: string    // our order_number — primary join key
  reference?: string            // PayHero internal id (UUID)
  CheckoutRequestID?: string    // Safaricom checkout request id (may be empty)
  provider?: string             // 'm-pesa'
  provider_reference?: string   // M-Pesa receipt number on success
  third_party_reference?: string // duplicate of provider_reference in success case
  payment_reference?: string
  transaction_date?: string
  merchant?: string
  amount?: number
  phone_number?: string
}

// ---------------------------------------------------------------------
// Transaction status (server-pulled reconciliation)
// GET /api/v2/transaction-status?reference=<phc_or_external_ref>
// ---------------------------------------------------------------------

export interface TransactionStatusResponse {
  success: boolean
  status: PayHeroCallbackStatus
  amount?: number
  external_reference?: string
  reference?: string
  provider_reference?: string
  third_party_reference?: string
  phone_number?: string
  message?: string
}

// ---------------------------------------------------------------------
// B2C / withdraw — POST /api/v2/withdraw
// ---------------------------------------------------------------------

export interface B2CRequest {
  amount: number
  phone_number: string
  channel_id: number
  external_reference: string  // we use `PO-<payout_id>`
  callback_url: string
  customer_name?: string
  network_code?: '63902' | '63903'
  provider?: 'm-pesa'
}

export interface B2CResponse {
  success: boolean
  status: 'QUEUED' | 'FAILED' | string
  reference?: string
  message?: string
  error?: string
}

// B2C callback shape mirrors STK callback shape (flat).
export type B2CCallback = PayHeroCallback

// ---------------------------------------------------------------------
// Refund — endpoint not yet documented; reconciliation path is the
// pragmatic fallback (PayHero balance-side refunds handled manually
// in the dashboard until the API is documented).
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------

export function isSuccessfulCallback(body: PayHeroCallback): boolean {
  return body.status === 'SUCCESS' && body.success === true
}

export function isFailedCallback(body: PayHeroCallback): boolean {
  return body.status === 'FAILED' || body.success === false
}
