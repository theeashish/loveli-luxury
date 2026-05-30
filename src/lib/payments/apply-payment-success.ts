/**
 * applyPaymentSuccess — the canonical post-payment chain.
 *
 * After PayHero confirms a payment SUCCEEDED, every call site needs to run
 * the same idempotent sequence:
 *
 *   1. Stamp the canonical PayHero refs on the order row.
 *   2. mark_order_paid (RPC, idempotent — short-circuits if already paid).
 *   3. provision_distributor (only for kind='distributor_signup').
 *   4. write_commission_ledger (non-fatal; warns on failure).
 *   5. sendOrderReceipt (no-op without RESEND env; non-fatal).
 *   6. audit_log entry tagged with the path that drove the reconcile.
 *
 * Before this helper landed (migration 033 era), the chain was duplicated
 * across 5 call sites (webhook, /api/payhero/reconcile, /admin orders
 * actions, /api/payhero/status self-heal, /api/cron/reconcile-pending) — a
 * single bug needed 5 fixes. Now there's one place.
 *
 * Idempotency: safe to call concurrently — mark_order_paid is the
 * serialisation point, and steps 4–6 are non-fatal write-once operations.
 *
 * Return shape: callers can decide how to surface warnings (HTTP body,
 * audit row, console.warn) without this helper deciding for them.
 */

import 'server-only'

import type { createServiceClient } from '../supabase/service'
import { sendOrderReceipt } from '../email/receipt'

export type Service = ReturnType<typeof createServiceClient>

export type ApplyPaymentSuccessInput = {
  /** The order id the payment settled. */
  orderId: number
  /** distributor_signup orders trigger provision_distributor. */
  orderKind: string
  /** PayHero's checkout reference (phc_*). Used as the mark_order_paid ref fallback. */
  payheroCheckoutReference: string
  /** M-Pesa receipt code from PayHero, if supplied. */
  mpesaReceipt: string | null
  /** PayHero's external reference (their per-transaction id), if supplied. */
  externalReference: string | null
  /** Where this reconcile originated — written to audit_log.action. */
  source:
    | 'webhook'
    | 'reconcile_api'
    | 'reconcile_admin'
    | 'status_self_heal'
    | 'cron_sweep'
  /** Admin/superadmin actor id when the source is reconcile_admin. */
  actorId?: string | null
}

export type ApplyPaymentSuccessResult = {
  /** True if mark_order_paid succeeded (the only step that can hard-fail). */
  paid: boolean
  /** Non-fatal warnings from the downstream chain. */
  warnings: string[]
  /** Set when mark_order_paid itself errored. */
  error?: string
}

const SOURCE_TO_AUDIT_ACTION: Record<
  ApplyPaymentSuccessInput['source'],
  string
> = {
  webhook: 'payment.applied.webhook',
  reconcile_api: 'payment.reconciled.api',
  reconcile_admin: 'order.reconcile.payhero',
  status_self_heal: 'payment.reconciled.status_poll',
  cron_sweep: 'payment.reconciled.cron',
}

export async function applyPaymentSuccess(
  service: Service,
  input: ApplyPaymentSuccessInput,
): Promise<ApplyPaymentSuccessResult> {
  const warnings: string[] = []

  // 1. Stamp the PayHero refs on the order.
  await (service.from('orders') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{
        error: { message: string } | null
      }>
    }
  })
    .update({
      payhero_external_reference: input.externalReference,
      payhero_mpesa_receipt: input.mpesaReceipt,
    })
    .eq('id', input.orderId)

  // 2. mark_order_paid — the only step that hard-fails the chain.
  const paidAt = new Date().toISOString()
  const markRes = (await service.rpc('mark_order_paid', {
    p_order_id: input.orderId,
    p_provider_ref: input.mpesaReceipt ?? input.payheroCheckoutReference,
    p_paid_at: paidAt,
  })) as { error: { message: string } | null }
  if (markRes.error) {
    return {
      paid: false,
      warnings,
      error: `mark_order_paid: ${markRes.error.message}`,
    }
  }

  // 3. provision_distributor (signup orders only).
  if (input.orderKind === 'distributor_signup') {
    const provRes = (await service.rpc('provision_distributor', {
      p_order_id: input.orderId,
    })) as { error: { message: string } | null }
    if (provRes.error) {
      warnings.push(`provision_distributor: ${provRes.error.message}`)
    }
  }

  // 4. write_commission_ledger — non-fatal.
  const ledgerRes = (await service.rpc('write_commission_ledger', {
    p_order_id: input.orderId,
  })) as { error: { message: string } | null }
  if (ledgerRes.error) {
    warnings.push(`write_commission_ledger: ${ledgerRes.error.message}`)
  }

  // 5. Receipt email — non-fatal; no-op without RESEND env.
  try {
    await sendOrderReceipt(service, input.orderId)
  } catch (err) {
    warnings.push(
      `receipt: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // 6. Audit row tagged with the path that drove the reconcile.
  await service.from('audit_log').insert({
    actor_id: input.actorId ?? null,
    action: SOURCE_TO_AUDIT_ACTION[input.source],
    resource_type: 'order',
    resource_id: String(input.orderId),
    after_data: {
      provider: 'payhero',
      checkout_reference: input.payheroCheckoutReference,
      mpesa_receipt: input.mpesaReceipt,
      external_reference: input.externalReference,
      reconciled_at: paidAt,
      source: input.source,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  })

  return { paid: true, warnings }
}
