/**
 * PayHero integration.
 *
 * Kenya-first M-Pesa STK push + B2C payouts.
 *
 * Auth: PayHero dashboard "API Keys" page generates a pre-encoded Basic
 *   auth token. We paste it into PAYHERO_AUTH_TOKEN as-is and prepend
 *   "Basic " in the Authorization header. We do NOT base64-encode
 *   anything ourselves — the dashboard already did.
 *
 * Webhook auth: PayHero does NOT sign webhooks. Security model is a
 *   secret token embedded in the callback URL itself. We register
 *   `https://…/api/payhero/webhook?key=<PAYHERO_WEBHOOK_TOKEN>` with
 *   PayHero; the webhook route compares the query param against env.
 *   Constant-time compare to defeat timing attacks.
 *
 * NEVER trust the frontend. Order state only flips on a webhook (or an
 * admin reconciliation call against PayHero's transaction-status API).
 */

import crypto from 'node:crypto'
import { getServerEnv } from '../env'
import type {
  StkPushRequest,
  StkPushResponse,
  TransactionStatusResponse,
  B2CRequest,
  B2CResponse,
} from './types'

const PAYHERO_API_BASE = 'https://backend.payhero.co.ke/api/v2'

// ---------------------------------------------------------------------
// Auth header
// ---------------------------------------------------------------------

function basicAuthHeader(): string {
  const env = getServerEnv()
  if (!env.PAYHERO_AUTH_TOKEN) {
    throw new Error('PAYHERO_AUTH_TOKEN is not configured')
  }
  return `Basic ${env.PAYHERO_AUTH_TOKEN}`
}

// ---------------------------------------------------------------------
// Phone-number normaliser — PayHero expects 254XXXXXXXXX
// ---------------------------------------------------------------------

export function normaliseMsisdn(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.length === 9) return `254${digits}`
  throw new Error(`Unrecognised Kenyan MSISDN: ${input}`)
}

// ---------------------------------------------------------------------
// Callback URL builder — embeds the webhook token so PayHero's POST
// arrives at a URL only PayHero (and we) know.
// ---------------------------------------------------------------------

export function buildCallbackUrl(baseUrl: string, path: string): string {
  const env = getServerEnv()
  if (!env.PAYHERO_WEBHOOK_TOKEN) {
    throw new Error('PAYHERO_WEBHOOK_TOKEN is not configured')
  }
  const url = new URL(path, baseUrl)
  url.searchParams.set('key', env.PAYHERO_WEBHOOK_TOKEN)
  return url.toString()
}

// ---------------------------------------------------------------------
// STK Push (inbound payment) — POST /api/v2/payments
// ---------------------------------------------------------------------

export async function initiateStkPush(args: {
  amountKes: number
  phone: string
  orderNumber: string
  customerName?: string
  callbackUrl: string
}): Promise<StkPushResponse> {
  const env = getServerEnv()
  if (!env.PAYHERO_CHANNEL_ID_STK) {
    throw new Error('PAYHERO_CHANNEL_ID_STK is not configured')
  }

  const body: StkPushRequest = {
    amount: args.amountKes,
    phone_number: normaliseMsisdn(args.phone),
    channel_id: Number(env.PAYHERO_CHANNEL_ID_STK),
    provider: 'm-pesa',
    external_reference: args.orderNumber,
    customer_name: args.customerName,
    callback_url: args.callbackUrl,
  }

  // Structured log so duplicate-fire investigations are a one-grep
  // operation against Vercel logs. If two of these appear for the
  // same `externalReference` within a minute, that's a fee charged
  // twice — start the audit there.
  // eslint-disable-next-line no-console
  console.log(
    '[payhero.stk.init]',
    JSON.stringify({
      externalReference: args.orderNumber,
      amountKes: args.amountKes,
      msisdn: body.phone_number,
      ts: new Date().toISOString(),
    }),
  )

  const res = await fetch(`${PAYHERO_API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => ({}))) as StkPushResponse
  if (!res.ok || json.success === false) {
    throw new Error(
      `PayHero STK push failed: HTTP ${res.status} ${JSON.stringify(json)}`,
    )
  }

  return json
}

// ---------------------------------------------------------------------
// Transaction status — GET /api/v2/transaction-status?reference=…
// ---------------------------------------------------------------------

export async function getTransactionStatus(
  reference: string,
): Promise<TransactionStatusResponse> {
  const url = `${PAYHERO_API_BASE}/transaction-status?reference=${encodeURIComponent(reference)}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: basicAuthHeader(),
      Accept: 'application/json',
    },
  })

  const json = (await res.json().catch(() => ({}))) as TransactionStatusResponse
  if (!res.ok) {
    throw new Error(
      `PayHero status check failed: HTTP ${res.status} ${JSON.stringify(json)}`,
    )
  }

  return json
}

// ---------------------------------------------------------------------
// B2C / withdraw — POST /api/v2/withdraw
// ---------------------------------------------------------------------

export async function initiateB2C(args: {
  amountKes: number
  phone: string
  payoutId: number
  callbackUrl: string
  customerName?: string
}): Promise<B2CResponse> {
  const env = getServerEnv()
  if (!env.PAYHERO_CHANNEL_ID_B2C) {
    throw new Error('PAYHERO_CHANNEL_ID_B2C is not configured')
  }

  const body: B2CRequest = {
    amount: args.amountKes,
    phone_number: normaliseMsisdn(args.phone),
    channel_id: Number(env.PAYHERO_CHANNEL_ID_B2C),
    external_reference: `PO-${args.payoutId}`,
    callback_url: args.callbackUrl,
    customer_name: args.customerName,
    provider: 'm-pesa',
  }

  const res = await fetch(`${PAYHERO_API_BASE}/withdraw`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => ({}))) as B2CResponse
  if (!res.ok || json.success === false) {
    throw new Error(
      `PayHero B2C failed: HTTP ${res.status} ${JSON.stringify(json)}`,
    )
  }

  return json
}

// ---------------------------------------------------------------------
// Webhook URL-token verification (replaces HMAC since PayHero doesn't
// sign). Constant-time compare to defeat timing attacks.
// ---------------------------------------------------------------------

export function verifyWebhookToken(receivedKey: string | null): boolean {
  if (!receivedKey) return false
  const env = getServerEnv()
  // If the token isn't configured yet, no key can match. We return
  // false (rather than throwing) so the GET URL-validation handler
  // and the POST receive-handler can both respond gracefully while
  // env setup is still in progress.
  if (!env.PAYHERO_WEBHOOK_TOKEN) return false
  const expected = env.PAYHERO_WEBHOOK_TOKEN
  if (receivedKey.length !== expected.length) return false
  return crypto.timingSafeEqual(
    Buffer.from(receivedKey),
    Buffer.from(expected),
  )
}

/**
 * Derive a stable event id from a flat PayHero callback body. Used as
 * the dedup key in webhook_deliveries. Prefers the most specific
 * identifier available.
 */
export function deriveEventId(body: unknown): string {
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>
    const id =
      (b.reference as string | undefined) ??
      (b.CheckoutRequestID as string | undefined) ??
      (b.provider_reference as string | undefined) ??
      (b.third_party_reference as string | undefined) ??
      (b.external_reference as string | undefined)
    if (id) return id
  }
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .slice(0, 32)
}
