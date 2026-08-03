/**
 * Payment service — the provider-agnostic entry point.
 *
 * `getPaymentProvider()` is the ONE place that knows the active provider
 * is IntaSend. A second provider (should one ever be added) plugs in by
 * implementing `PaymentProvider` and being returned here based on
 * `getCurrentProvider()` from the existing `dispatcher.ts` — that
 * function is already the documented "single source of truth for which
 * provider is active" and is left untouched.
 *
 * `reconcileByInvoiceId` is the shared verify→apply step used by both
 * the `/api/intasend/status` self-heal endpoint and the
 * `/api/cron/reconcile-pending` sweep, so the two Phase-2 call sites the
 * codebase's own comments describe both go through one implementation.
 */

import 'server-only'

import { getCurrentProvider } from './dispatcher'
import { IntaSendProvider } from './intasend-provider'
import { applyPaymentSuccess, type ApplyPaymentSuccessResult } from './apply-payment-success'
import { createServiceClient } from '../supabase/service'
import type { PaymentProvider } from './provider'

let _provider: PaymentProvider | null = null

/** Returns the active provider singleton. Memoised — provider instances are stateless. */
export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider
  const current = getCurrentProvider()
  switch (current) {
    case 'intasend':
      _provider = new IntaSendProvider()
      return _provider
    default: {
      const _exhaustive: never = current
      throw new Error(`No PaymentProvider implementation for provider: ${_exhaustive}`)
    }
  }
}

/** Test-only: clear the memoised provider so a test can construct a fresh one. */
export function __resetPaymentProviderForTesting(): void {
  _provider = null
}

export type ReconcileSource = 'reconcile_api' | 'reconcile_admin' | 'status_poll' | 'cron_sweep'

export interface ReconcileOutcome {
  invoiceId: string
  state: 'pending' | 'processing' | 'complete' | 'failed' | 'unchanged'
  applied: ApplyPaymentSuccessResult | null
}

/**
 * Verify one invoice's status with the provider and, if COMPLETE, run the
 * full `applyPaymentSuccess` chain. Used by both the customer-facing
 * status-poll endpoint and the cron sweep — the two "Phase 2" call sites
 * `dispatcher.ts` and `reconcile-pending/route.ts` already describe in
 * their header comments.
 */
export async function reconcileByInvoiceId(
  invoiceId: string,
  orderId: number,
  orderKind: string,
  source: ReconcileSource,
  actorId?: string | null,
): Promise<ReconcileOutcome> {
  const provider = getPaymentProvider()
  const status = await provider.verifyPayment(invoiceId)

  if (status.state !== 'complete') {
    if (status.state === 'failed') {
      const service = createServiceClient()
      await (
        service.from('payments' as never) as unknown as {
          update: (v: Record<string, unknown>) => {
            eq: (col: string, val: unknown) => Promise<{ error: unknown }>
          }
        }
      )
        .update({ status: 'failed', raw_payload: status.raw })
        .eq('invoice_id', invoiceId)
    }
    return { invoiceId, state: status.state, applied: null }
  }

  const service = createServiceClient()
  const applied = await applyPaymentSuccess(service, {
    orderId,
    orderKind,
    provider: 'intasend',
    invoiceId,
    providerRef: status.providerRef ?? invoiceId,
    receipt: status.mpesaReceipt ?? null,
    source,
    actorId: actorId ?? null,
    rawPayload: status.raw,
  })

  return { invoiceId, state: 'complete', applied }
}
