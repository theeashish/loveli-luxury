/**
 * IntaSend B2C payout (send-money) calls.
 *
 * Phase 4 of the PayHero → IntaSend migration — this is the piece the
 * admin payout actions (`/admin/payouts/[id]/actions.ts`,
 * `/admin/payouts/bulk-actions.ts`) have been calling out to via a
 * commented-out blueprint since Phase 0. This module implements that
 * exact blueprint contract: `initiateIntasendB2C({ amountKes, msisdn,
 * payoutId, beneficiaryName, narrative })` → `{ trackingId, status, raw }`.
 *
 * Endpoints used (from the vendored `intasend-node` SDK + official docs,
 * developers.intasend.com/docs/m-pesa-b2c and /docs/payment-statuses-reference):
 *   - payouts().mpesa({ currency, requires_approval, transactions: [...] })
 *     → POST /api/v1/send-money/initiate/ with provider='MPESA-B2C'
 *   - payouts().approve(rawInitiateResponse)
 *     → POST /api/v1/send-money/approve/
 *   - payouts().status({ tracking_id })
 *     → POST /api/v1/send-money/status/
 *
 * Approval ceiling: `INTASEND_PAYOUT_APPROVAL_CEILING_KES` (already
 * defined in env.ts, defaulting to 100,000 KES) decides `requires_approval`.
 * Above the ceiling, IntaSend holds the batch until `.approve()` is
 * called — the payouts row is stamped `pending_approval` (migration 046)
 * and a superadmin must explicitly approve it (see
 * `approvePendingPayout` server action).
 *
 * Every call is logged to `payment_attempts` (attempt_type: 'b2c_transfer'
 * | 'payout_approve' | 'payout_status') for the same forensic-audit reason
 * `dispatcher.ts` logs collection attempts — never silent, never blocking.
 */

import 'server-only'

import { z } from 'zod'
import { getIntasend } from './client'
import { createServiceClient } from '../supabase/service'
import { getServerEnv } from '../env'
import { PayoutError, TimeoutError, ValidationError } from '../payments/errors'

const PAYOUT_CALL_TIMEOUT_MS = 20_000

/**
 * Race a provider call against a timeout so a hung TCP connection can't
 * wedge an admin Server Action forever. Rejects with TimeoutError; the
 * underlying request may still complete provider-side (IntaSend send-money
 * dispatch is documented as idempotent per-tracking_id on their end, but
 * we do not retry automatically here — see file header).
 */
async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${PAYOUT_CALL_TIMEOUT_MS}ms`)),
      PAYOUT_CALL_TIMEOUT_MS,
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

async function logPayoutAttempt(
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
      console.warn('[intasend/payouts] payment_attempts insert failed:', error.message)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[intasend/payouts] payment_attempts insert skipped:', (e as Error).message)
  }
}

// -----------------------------------------------------------------------------
// initiate
// -----------------------------------------------------------------------------

/**
 * The initiate response's only field the SDK/docs guarantee is
 * `tracking_id` ("For every request, we also generate a tracking id" —
 * developers.intasend.com/docs/send-money#how-to-use-send-payments-api).
 * Everything else is passed through untyped and persisted verbatim to
 * `payouts.raw_payload` so `approve()` can replay the exact object IntaSend
 * expects — the docs show `approve(response)` taking the full initiate
 * response, not just the tracking id.
 */
const initiateResponseSchema = z.object({
  tracking_id: z.string(),
}).passthrough()

export interface InitiateB2CArgs {
  payoutId: number
  amountKes: number
  /** 254XXXXXXXXX — no leading '+'. Matches the B2C `account` field per docs. */
  msisdn: string
  beneficiaryName: string
  narrative: string
}

export type B2CDispatchStatus = 'processing' | 'pending_approval'

export interface InitiateB2CResult {
  trackingId: string
  status: B2CDispatchStatus
  raw: Record<string, unknown>
}

/**
 * Initiate a single-beneficiary M-Pesa B2C payout.
 *
 * One `payouts` row == one IntaSend `transactions[]` entry — the admin
 * UI fires payouts one at a time (or loops one-at-a-time in the bulk
 * action), never batching multiple distributors into a single IntaSend
 * request, so `transactions` here always has exactly one item.
 */
export async function initiateIntasendB2C(args: InitiateB2CArgs): Promise<InitiateB2CResult> {
  if (!/^254\d{9}$/.test(args.msisdn)) {
    throw new ValidationError(
      `msisdn must be 254XXXXXXXXX for IntaSend B2C, got: ${args.msisdn.replace(/\d(?=\d{2})/g, '*')}`,
    )
  }
  if (!Number.isInteger(args.amountKes) || args.amountKes <= 0) {
    throw new ValidationError('amountKes must be a positive integer')
  }

  const env = getServerEnv()
  const service = createServiceClient()
  const intasend = getIntasend()

  const requiresApproval = args.amountKes > env.INTASEND_PAYOUT_APPROVAL_CEILING_KES ? 'YES' : 'NO'

  const payoutsApi = intasend.payouts() as unknown as {
    mpesa: (payload: Record<string, unknown>) => Promise<unknown>
  }

  let raw: unknown
  try {
    raw = await withTimeout(
      'IntaSend B2C initiate',
      payoutsApi.mpesa({
        currency: 'KES',
        requires_approval: requiresApproval,
        transactions: [
          {
            name: args.beneficiaryName,
            account: args.msisdn,
            amount: String(args.amountKes),
            narrative: args.narrative,
          },
        ],
      }),
    )
  } catch (e) {
    await logPayoutAttempt(service, {
      order_id: null,
      provider: 'intasend',
      attempt_type: 'b2c_transfer',
      status: 'error',
      error_message: (e as Error).message,
      request_payload: { payoutId: args.payoutId, amountKes: args.amountKes, requiresApproval },
    })
    if (e instanceof TimeoutError) throw e
    throw new PayoutError(`IntaSend B2C initiate failed: ${(e as Error).message}`, {
      payoutId: args.payoutId,
    })
  }

  const parsed = initiateResponseSchema.safeParse(raw)
  if (!parsed.success) {
    await logPayoutAttempt(service, {
      order_id: null,
      provider: 'intasend',
      attempt_type: 'b2c_transfer',
      status: 'failed',
      error_message: `unparseable response: ${parsed.error.message}`,
      response_payload: raw as Record<string, unknown>,
    })
    throw new PayoutError(
      `IntaSend returned an unexpected B2C initiate shape: ${parsed.error.message}`,
      { payoutId: args.payoutId },
    )
  }

  await logPayoutAttempt(service, {
    order_id: null,
    provider: 'intasend',
    attempt_type: 'b2c_transfer',
    status: 'initiated',
    request_payload: { payoutId: args.payoutId, amountKes: args.amountKes, requiresApproval },
    response_payload: parsed.data as Record<string, unknown>,
  })

  return {
    trackingId: parsed.data.tracking_id,
    status: requiresApproval === 'YES' ? 'pending_approval' : 'processing',
    raw: parsed.data as Record<string, unknown>,
  }
}

// -----------------------------------------------------------------------------
// approve
// -----------------------------------------------------------------------------

export interface ApproveB2CResult {
  trackingId: string
  raw: Record<string, unknown>
}

/**
 * Approve a payout batch that was initiated with requires_approval='YES'.
 *
 * The docs' JS example shows `payouts.approve(resp, false)` with a second
 * argument, but the vendored `intasend-node` SDK's `Payouts.approve`
 * (dist/payouts.js) only accepts one parameter — the raw initiate
 * response object. We call it with exactly what the installed SDK's
 * source accepts; the extra arg in the doc snippet appears to be either
 * stale or ignored by the JS client either way, so passing it would be
 * cargo-culting a no-op rather than following documented behaviour.
 */
export async function approveIntasendB2C(
  payoutId: number,
  rawInitiateResponse: Record<string, unknown>,
): Promise<ApproveB2CResult> {
  const service = createServiceClient()
  const intasend = getIntasend()
  const payoutsApi = intasend.payouts() as unknown as {
    approve: (payload: Record<string, unknown>) => Promise<unknown>
  }

  let raw: unknown
  try {
    raw = await withTimeout('IntaSend B2C approve', payoutsApi.approve(rawInitiateResponse))
  } catch (e) {
    await logPayoutAttempt(service, {
      order_id: null,
      provider: 'intasend',
      attempt_type: 'payout_approve',
      status: 'error',
      error_message: (e as Error).message,
      request_payload: { payoutId },
    })
    if (e instanceof TimeoutError) throw e
    throw new PayoutError(`IntaSend B2C approve failed: ${(e as Error).message}`, { payoutId })
  }

  const parsed = initiateResponseSchema.safeParse(raw)
  await logPayoutAttempt(service, {
    order_id: null,
    provider: 'intasend',
    attempt_type: 'payout_approve',
    status: parsed.success ? 'success' : 'failed',
    request_payload: { payoutId },
    response_payload: (parsed.success ? parsed.data : (raw as Record<string, unknown>)) ?? {},
  })
  if (!parsed.success) {
    throw new PayoutError(
      `IntaSend returned an unexpected approve response shape: ${parsed.error.message}`,
      { payoutId },
    )
  }

  return { trackingId: parsed.data.tracking_id, raw: parsed.data as Record<string, unknown> }
}

// -----------------------------------------------------------------------------
// status
// -----------------------------------------------------------------------------

const statusResponseSchema = z.object({
  tracking_id: z.string().optional(),
  status: z.string().optional(),
  transactions: z.array(z.record(z.unknown())).optional(),
}).passthrough()

export type B2CStatusResult = z.infer<typeof statusResponseSchema>

/**
 * Poll IntaSend for a payout batch's current status by tracking_id.
 * Belt-and-braces for the cron sweep — the webhook is the primary path.
 */
export async function getIntasendPayoutStatus(trackingId: string): Promise<B2CStatusResult> {
  const intasend = getIntasend()
  const payoutsApi = intasend.payouts() as unknown as {
    status: (payload: Record<string, unknown>) => Promise<unknown>
  }

  let raw: unknown
  try {
    raw = await withTimeout(
      'IntaSend B2C status',
      payoutsApi.status({ tracking_id: trackingId }),
    )
  } catch (e) {
    if (e instanceof TimeoutError) throw e
    throw new PayoutError(`IntaSend B2C status check failed: ${(e as Error).message}`, {
      trackingId,
    })
  }

  const parsed = statusResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new PayoutError(
      `IntaSend returned an unexpected B2C status shape: ${parsed.error.message}`,
      { trackingId },
    )
  }
  return parsed.data
}
