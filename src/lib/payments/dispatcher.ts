/**
 * Payment dispatcher.
 *
 * Provider-neutral interface for initiating a customer payment. The
 * concrete provider call lives in `src/lib/intasend/client.ts`; this
 * module is the boundary every caller imports from so providers can be
 * swapped without touching checkout / signup / admin reconcile / cron
 * sweep.
 *
 * Phase 1 of the PayHero → IntaSend migration (2026-06-03): the
 * IntaSend STK push is now wired. `initiatePayment` calls
 * `collection.mpesaStkPush` on the SDK, writes a row to `payment_attempts`
 * for forensic audit (best-effort), and returns the invoice id the
 * frontend uses to poll /api/intasend/status.
 *
 * Audit-logging contract: writes to `payment_attempts` are best-effort.
 * That table is the per-API-call debug log (separate from the new
 * `payments` state record); if it ever fails (RLS, temporary outage),
 * payment initiation still succeeds. The defensive shape below was added
 * after migration 030 exposed a silent column-drift bug — supabase-js
 * returns DB errors in the resolved `{ error }` object, so we inspect
 * `error` explicitly rather than relying on try/catch to surface them.
 */

import 'server-only'

import { createServiceClient } from '../supabase/service'
import { getIntasend, getFloatWalletId } from '../intasend/client'
import { stkPushResponseSchema } from '../intasend/types'

export type PaymentProvider = 'intasend'

/**
 * The single source of truth for which provider is active. Future-proofed
 * for a multi-provider config (e.g. an `active_provider` setting in
 * `config_settings`); today there is exactly one option.
 */
export function getCurrentProvider(): PaymentProvider {
  return 'intasend'
}

export interface InitiatePaymentArgs {
  orderId: number
  orderNumber: string
  /** KES, expressed as a whole-shilling integer (not minor units). */
  amountKes: number
  customer: {
    email: string
    name: string
    /** E.164 phone (+254...). Validated upstream. */
    phone: string
  }
  description: string
}

export interface InitiatePaymentResult {
  provider: PaymentProvider
  /**
   * Provider's unique reference for this transaction (IntaSend
   * invoice id). The customer's frontend polls
   * /api/intasend/status with this id.
   */
  invoiceId?: string
  /** Lifecycle hint for the frontend. */
  status?: 'stk_pushed' | 'queued'
}

/**
 * Best-effort audit insert. Never throws; logs the underlying error if one
 * comes back. Supabase-js returns DB errors in the resolved `{ error }`
 * object rather than throwing, so the outer try/catch only catches network
 * failures — we have to inspect `error` explicitly or the failure is
 * silent. Migration 030 was the bug that locked this contract in.
 *
 * Exported so tests can lock the non-silent contract in.
 */
export async function logAttempt(
  service: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await (
      service.from('payment_attempts' as never) as unknown as {
        insert: (
          v: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>
      }
    ).insert(row)
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(
        '[dispatcher] payment_attempts insert failed:',
        error.message,
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[dispatcher] payment_attempts insert skipped:',
      (e as Error).message,
    )
  }
}

/**
 * Initiate a customer M-Pesa STK push via IntaSend.
 *
 * Flow:
 *   1. Call IntaSend `collection.mpesaStkPush({ phone, amount, api_ref })`.
 *      `api_ref` is the order_number — IntaSend echoes it back in the
 *      webhook so the handler can resolve invoice → order without
 *      another DB round-trip.
 *   2. Validate the response with the Zod schema so we never carry
 *      `any` past this boundary.
 *   3. Insert the `payments` row in `pending` state, keyed on the
 *      returned `invoice_id`.
 *   4. Best-effort insert into `payment_attempts` for audit.
 *   5. Return the invoice id so the frontend can poll
 *      /api/intasend/status.
 *
 * The float wallet id is passed via `api_ref`'s metadata field rather
 * than the SDK's body — IntaSend STK pushes always land in the account's
 * default wallet, but we still annotate the attempt with the configured
 * wallet for forensic clarity.
 */
export async function initiatePayment(
  args: InitiatePaymentArgs,
): Promise<InitiatePaymentResult> {
  const service = createServiceClient()
  const intasend = getIntasend()
  // Read the wallet id so a misconfiguration surfaces here rather than
  // silently letting the STK push land in the wrong account.
  const walletId = getFloatWalletId()

  const collection = (intasend.collection() as unknown as {
    mpesaStkPush: (payload: Record<string, unknown>) => Promise<unknown>
  })

  let raw: unknown
  try {
    raw = await collection.mpesaStkPush({
      phone_number: args.customer.phone,
      name: args.customer.name,
      email: args.customer.email,
      amount: args.amountKes,
      api_ref: args.orderNumber,
      wallet_id: walletId,
    })
  } catch (e) {
    await logAttempt(service, {
      order_id: args.orderId,
      provider: 'intasend',
      attempt_type: 'stk_push',
      status: 'error',
      error_message: (e as Error).message,
      request_payload: {
        amount: args.amountKes,
        phone: args.customer.phone,
        orderNumber: args.orderNumber,
        wallet_id: walletId,
      },
    })
    throw e
  }

  const parsed = stkPushResponseSchema.safeParse(raw)
  if (!parsed.success) {
    await logAttempt(service, {
      order_id: args.orderId,
      provider: 'intasend',
      attempt_type: 'stk_push',
      status: 'failed',
      error_message: `unparseable response: ${parsed.error.message}`,
      response_payload: raw as Record<string, unknown>,
    })
    throw new Error(
      `IntaSend returned an unexpected STK push shape: ${parsed.error.message}`,
    )
  }

  const invoiceId = parsed.data.invoice.invoice_id

  // Insert the payments row. Idempotent via UNIQUE(invoice_id) — if a
  // concurrent retry-stk fires between us and the next call, the second
  // insert no-ops and the existing row continues to track the same
  // invoice.
  const paymentInsert = (await (service.from('payments' as never) as unknown as {
    insert: (v: Record<string, unknown>) => Promise<{
      error: { message: string; code?: string } | null
    }>
  }).insert({
    user_id: null, // Set by the caller if it has it; not required for retail
    order_id: args.orderId,
    invoice_id: invoiceId,
    amount_cents: args.amountKes * 100,
    currency: 'KES',
    channel: 'mpesa',
    status: 'pending',
    raw_payload: parsed.data as unknown as Record<string, unknown>,
  })) as { error: { message: string; code?: string } | null }
  if (paymentInsert.error && paymentInsert.error.code !== '23505') {
    // Not a uniqueness conflict — surface as an audit warning but don't
    // block the STK push. The webhook still has the invoice and will
    // self-heal on receipt.
    // eslint-disable-next-line no-console
    console.warn(
      '[dispatcher] payments insert failed:',
      paymentInsert.error.message,
    )
  }

  await logAttempt(service, {
    order_id: args.orderId,
    provider: 'intasend',
    attempt_type: 'stk_push',
    request_payload: {
      amount: args.amountKes,
      phone: args.customer.phone,
      orderNumber: args.orderNumber,
      wallet_id: walletId,
    },
    response_payload: parsed.data as unknown as Record<string, unknown>,
    status: 'initiated',
  })

  return {
    provider: 'intasend',
    invoiceId,
    status: 'stk_pushed',
  }
}
