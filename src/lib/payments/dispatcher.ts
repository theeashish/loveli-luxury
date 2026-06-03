/**
 * Payment dispatcher.
 *
 * Provider-neutral interface for initiating a customer payment. The
 * concrete provider implementation lives in `src/lib/intasend/*` (Phase 1+
 * of the PayHero → IntaSend migration). This module is the boundary every
 * caller imports from so providers can be swapped without touching
 * checkout / signup / admin reconcile / cron sweep.
 *
 * Phase 0 status (2026-06-03):
 *   PayHero has been removed. IntaSend is not yet wired. `initiatePayment`
 *   throws a clear runtime error to make sure no caller silently no-ops in
 *   production; the type surface stays stable so cross-cutting modules
 *   continue to compile. Phase 1 replaces the throwing stub with the real
 *   IntaSend SDK call.
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

export type PaymentProvider = 'intasend'

/**
 * The single source of truth for which provider is active. Phase 1 may
 * grow this into a config-driven lookup (env var + flag in
 * `config_settings`), but today there is exactly one option.
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
   * Provider's unique reference for this transaction. For IntaSend this is
   * the invoice id; the customer's frontend polls /api/intasend/status with
   * this id. Replaces what PayHero called `checkoutReference`.
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
 * Initiate a customer payment with the current provider.
 *
 * Phase 0: throws. Phase 1 will replace this with the real IntaSend call.
 * The throw is deliberate — silently no-op'ing a checkout would be far
 * worse than a clear "not configured" error reaching the API layer.
 */
export async function initiatePayment(
  _args: InitiatePaymentArgs,
): Promise<InitiatePaymentResult> {
  throw new Error(
    '[dispatcher] IntaSend provider not wired. Phase 1 of the PayHero → IntaSend migration introduces the real implementation. See docs/intasend-migration-2026-06.md for the cut-over plan.',
  )
}
