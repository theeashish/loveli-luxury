/**
 * Flutterwave integration.
 *
 * This is the unified payment platform for Loveli Luxury International.
 * Handles both directions:
 *   - Inbound: card, M-Pesa STK, mobile money, bank transfer (Charges API)
 *   - Outbound: M-Pesa B2C payouts to distributors (Transfer API)
 *
 * Webhook signature verification is mandatory before trusting any callback.
 */

import crypto from 'node:crypto'
import { getServerEnv } from '../env'

const FLUTTERWAVE_API_BASE = 'https://api.flutterwave.com/v3'

// -----------------------------------------------------------------------------
// Webhook signature verification
// -----------------------------------------------------------------------------

/**
 * Verify the Flutterwave webhook signature.
 *
 * Flutterwave sends a `verif-hash` header on every webhook. It must match
 * the secret hash configured in the Flutterwave dashboard. Constant-time
 * comparison prevents timing attacks.
 */
export function verifyWebhookSignature(receivedHash: string | null): boolean {
  if (!receivedHash) return false

  const env = getServerEnv()
  const expected = env.FLUTTERWAVE_WEBHOOK_SECRET_HASH

  if (receivedHash.length !== expected.length) return false

  return crypto.timingSafeEqual(
    Buffer.from(receivedHash),
    Buffer.from(expected)
  )
}

// -----------------------------------------------------------------------------
// Create a hosted checkout link (Standard payments)
// -----------------------------------------------------------------------------

export interface CreatePaymentLinkRequest {
  /** Our internal unique reference. Must be unique per attempt — typically the
   *  order_number. Flutterwave echoes it back on the webhook and redirect. */
  txRef: string
  /** Amount in major units (whole KES). The Charges API expects major units;
   *  callers in this codebase are responsible for the BigInt-minor → integer-major
   *  conversion at the boundary. */
  amountKes: number
  /** Where to redirect the buyer after payment. Should resolve to /checkout/return. */
  redirectUrl: string
  customer: {
    email: string
    name?: string
    phonenumber?: string
  }
  /** Free-form key/values stored alongside the transaction. We send the order id
   *  here so the webhook can resolve back to our row even if tx_ref is malformed. */
  meta?: Record<string, string | number | null>
  /** Optional branding overrides for the hosted page. */
  customizations?: {
    title?: string
    description?: string
    logo?: string
  }
  /** ISO-3 currency. Defaults to KES. */
  currency?: string
}

export interface CreatePaymentLinkResponse {
  link: string
}

export async function createPaymentLink(
  req: CreatePaymentLinkRequest
): Promise<CreatePaymentLinkResponse> {
  const env = getServerEnv()

  const response = await fetch(`${FLUTTERWAVE_API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: req.txRef,
      amount: req.amountKes,
      currency: req.currency ?? 'KES',
      redirect_url: req.redirectUrl,
      customer: req.customer,
      meta: req.meta ?? {},
      customizations: req.customizations ?? {
        title: 'Loveli Luxury International',
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Flutterwave create payment failed: ${response.status} ${await response.text()}`)
  }

  const json = (await response.json()) as {
    status: string
    message?: string
    data?: { link: string }
  }

  if (json.status !== 'success' || !json.data?.link) {
    throw new Error(`Flutterwave create payment non-success: ${JSON.stringify(json)}`)
  }

  return { link: json.data.link }
}

// -----------------------------------------------------------------------------
// Verify a transaction by id (after redirect)
// -----------------------------------------------------------------------------

export interface FlutterwaveTransaction {
  id: number
  tx_ref: string
  status: 'successful' | 'failed' | 'pending'
  amount: number
  currency: string
  customer: { email: string; phone_number?: string; name?: string }
  payment_type: string
  meta?: Record<string, unknown>
}

export async function verifyTransaction(transactionId: number): Promise<FlutterwaveTransaction> {
  const env = getServerEnv()
  const response = await fetch(
    `${FLUTTERWAVE_API_BASE}/transactions/${transactionId}/verify`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Flutterwave verify failed: ${response.status} ${await response.text()}`)
  }

  const json = await response.json() as { status: string; data: FlutterwaveTransaction }
  if (json.status !== 'success') {
    throw new Error(`Flutterwave verify returned non-success: ${JSON.stringify(json)}`)
  }

  return json.data
}

// -----------------------------------------------------------------------------
// Refund a transaction (full or partial)
// -----------------------------------------------------------------------------

export interface RefundResponse {
  flutterwaveRefundId: string
  status: 'completed' | 'pending' | 'failed' | string
  amountKes: number
}

/**
 * Issue a refund against a previous successful charge.
 *
 *   amountKes  Optional. Omit for a full refund. The Flutterwave Refunds API
 *              accepts an `amount` field for partial refunds, but Phase 4
 *              only exposes full refunds in the admin UI; partials are a
 *              follow-up.
 *
 * Returns a normalised refund response. The Refunds API response is
 * synchronous-ish: the refund moves to `completed` immediately for cards
 * but stays `pending` for some methods until the bank acknowledges. The
 * webhook is the canonical confirmation; this helper only surfaces the
 * initial state.
 */
export async function refundTransaction(
  transactionId: number,
  amountKes?: number,
): Promise<RefundResponse> {
  const env = getServerEnv()

  const response = await fetch(
    `${FLUTTERWAVE_API_BASE}/transactions/${transactionId}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        amountKes !== undefined ? { amount: amountKes } : {},
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Flutterwave refund failed: ${response.status} ${await response.text()}`,
    )
  }

  const json = (await response.json()) as {
    status: string
    message?: string
    data?: { id: number; amount_refunded: number; status: string }
  }
  if (json.status !== 'success' || !json.data) {
    throw new Error(`Flutterwave refund non-success: ${JSON.stringify(json)}`)
  }

  return {
    flutterwaveRefundId: String(json.data.id),
    status: json.data.status,
    amountKes: json.data.amount_refunded,
  }
}

// -----------------------------------------------------------------------------
// M-Pesa B2C payout to a distributor
// -----------------------------------------------------------------------------

export interface PayoutRequest {
  /** Distributor's M-Pesa number in E.164 format e.g. +254712345678 */
  msisdn: string
  /** Amount in KES whole shillings (Flutterwave uses major units for transfers) */
  amountKes: number
  /** Internal payout id, used as the unique reference */
  reference: string
  /** Narration shown on M-Pesa statement */
  narration: string
}

export interface PayoutResponse {
  flutterwaveTransferId: string
  status: 'NEW' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  reference: string
}

export async function initiateMpesaPayout(req: PayoutRequest): Promise<PayoutResponse> {
  const env = getServerEnv()

  // Flutterwave Transfer API requires the local number format for Kenya
  const accountNumber = req.msisdn.startsWith('+254') ? req.msisdn.slice(1) : req.msisdn

  const response = await fetch(`${FLUTTERWAVE_API_BASE}/transfers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_bank: 'MPS',                  // Mobile money Kenya
      account_number: accountNumber,
      amount: req.amountKes,
      narration: req.narration,
      currency: 'KES',
      reference: req.reference,
      beneficiary_name: 'Loveli Distributor Payout',
      meta: [{ mobile_number: accountNumber }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Flutterwave transfer failed: ${response.status} ${await response.text()}`)
  }

  const json = await response.json() as {
    status: string
    data: { id: number; status: string; reference: string }
  }

  if (json.status !== 'success') {
    throw new Error(`Flutterwave transfer non-success: ${JSON.stringify(json)}`)
  }

  return {
    flutterwaveTransferId: String(json.data.id),
    status: json.data.status as PayoutResponse['status'],
    reference: json.data.reference,
  }
}
