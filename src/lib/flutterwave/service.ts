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
