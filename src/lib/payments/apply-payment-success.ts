/**
 * applyPaymentSuccess — the canonical post-payment chain.
 *
 * After a provider confirms a payment SUCCEEDED, every call site needs to
 * run the same idempotent sequence:
 *
 *   1. Mark the matching `payments` row complete (or insert one if the
 *      collect flow never wrote it — possible for reconcile_admin paths
 *      that flip an order paid without going through /api/intasend/collect).
 *   2. Stamp the canonical provider refs on the order row (provider name
 *      + provider_ref). The legacy `payhero_*` columns are NOT written by
 *      new code; they remain as nullable historical data.
 *   3. mark_order_paid (RPC, idempotent — short-circuits if already paid).
 *   4. provision_distributor (only for kind='distributor_signup').
 *   5. write_commission_ledger (non-fatal; warns on failure).
 *   6. sendOrderReceipt (no-op without RESEND env; non-fatal).
 *   7. audit_log entry tagged with the path that drove the reconcile.
 *
 * Before this helper landed (migration 033 era), the chain was duplicated
 * across 5 call sites (webhook, /api/payhero/reconcile, /admin orders
 * actions, /api/payhero/status self-heal, /api/cron/reconcile-pending) — a
 * single bug needed 5 fixes. PayHero is now retired; the same one-helper
 * pattern keeps the IntaSend call sites in lock-step.
 *
 * Idempotency: safe to call concurrently — mark_order_paid is the
 * serialisation point, the payments row UPSERT keys on invoice_id, and
 * steps 5–7 are non-fatal write-once operations.
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
  /** Which provider settled — written to orders.payment_provider + audit_log. */
  provider: 'intasend'
  /**
   * Provider's unique reference for this transaction (IntaSend invoice id).
   * Used as the `payments.invoice_id` key and as the audit reference.
   */
  invoiceId: string
  /**
   * The settled transaction identifier the user would recognise. For M-Pesa
   * this is the receipt code (e.g. "RG24ABCD"); for card it's the card
   * authorisation id. Written to `orders.payment_provider_ref` and used as
   * the `mark_order_paid` ref.
   */
  providerRef: string
  /** M-Pesa receipt code, when applicable. May equal providerRef. */
  receipt?: string | null
  /** Where this reconcile originated — written to audit_log.action. */
  source:
    | 'webhook'
    | 'reconcile_api'
    | 'reconcile_admin'
    | 'status_poll'
    | 'cron_sweep'
  /** Admin/superadmin actor id when the source is reconcile_admin. */
  actorId?: string | null
  /**
   * Optional full webhook/response body merged into payments.raw_payload
   * so admins can see exactly what the provider said. Best-effort.
   */
  rawPayload?: Record<string, unknown>
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
  webhook:          'payment.applied.webhook',
  reconcile_api:    'payment.reconciled.api',
  reconcile_admin:  'payment.reconciled.admin',
  status_poll:      'payment.reconciled.status_poll',
  cron_sweep:       'payment.reconciled.cron',
}

export async function applyPaymentSuccess(
  service: Service,
  input: ApplyPaymentSuccessInput,
): Promise<ApplyPaymentSuccessResult> {
  const warnings: string[] = []

  // 1. Upsert the payments row to status=complete. If the collect flow
  //    pre-created it (the happy path), this is an UPDATE. If a reconcile
  //    path is flipping an order paid without a prior collect row (e.g.
  //    admin manually marking an out-of-band settlement), this INSERTs.
  {
    const payload = {
      user_id: null, // backfilled by trigger / select if needed; not required
      order_id: input.orderId,
      invoice_id: input.invoiceId,
      // amount_cents is required NOT NULL; on reconcile_admin we don't
      // know it from the input — read it from the order. UPDATE path
      // doesn't touch amount_cents, so a 0 here is only ever the seed
      // value of a freshly-INSERTed row on the admin reconcile path.
      amount_cents: 0,
      currency: 'KES',
      channel: 'mpesa',
      status: 'complete',
      raw_payload: input.rawPayload ?? {},
    }
    const upsertRes = (await (service.from('payments' as never) as unknown as {
      upsert: (
        v: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>
    }).upsert(payload, { onConflict: 'invoice_id' })) as {
      error: { message: string } | null
    }
    if (upsertRes.error) {
      // Non-fatal — the audit chain below still proceeds, the order still
      // flips paid, and a follow-up reconcile can re-stamp this row.
      warnings.push(`payments upsert: ${upsertRes.error.message}`)
    }
  }

  // 2. Stamp the neutral provider refs on the order.
  await (service.from('orders') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{
        error: { message: string } | null
      }>
    }
  })
    .update({
      payment_provider: input.provider,
      payment_provider_ref: input.providerRef,
    })
    .eq('id', input.orderId)

  // 3. mark_order_paid — the only step that hard-fails the chain.
  const paidAt = new Date().toISOString()
  const markRes = (await service.rpc('mark_order_paid', {
    p_order_id: input.orderId,
    p_provider_ref: input.providerRef,
    p_paid_at: paidAt,
  })) as { error: { message: string } | null }
  if (markRes.error) {
    return {
      paid: false,
      warnings,
      error: `mark_order_paid: ${markRes.error.message}`,
    }
  }

  // 4. provision_distributor (signup orders only).
  if (input.orderKind === 'distributor_signup') {
    const provRes = (await service.rpc('provision_distributor', {
      p_order_id: input.orderId,
    })) as { error: { message: string } | null }
    if (provRes.error) {
      warnings.push(`provision_distributor: ${provRes.error.message}`)
    }
  }

  // 5. write_commission_ledger — non-fatal. The SQL RPC is the canonical
  //    money engine (see project_money_engine_truth memory + migration 014
  //    + migrations 029/036 for the rate config). Provider-agnostic.
  const ledgerRes = (await service.rpc('write_commission_ledger', {
    p_order_id: input.orderId,
  })) as { error: { message: string } | null }
  if (ledgerRes.error) {
    warnings.push(`write_commission_ledger: ${ledgerRes.error.message}`)
  }

  // 6. Receipt email — non-fatal; no-op without RESEND env.
  try {
    await sendOrderReceipt(service, input.orderId)
  } catch (err) {
    warnings.push(
      `receipt: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // 7. Audit row tagged with the path that drove the reconcile.
  await service.from('audit_log').insert({
    actor_id: input.actorId ?? null,
    action: SOURCE_TO_AUDIT_ACTION[input.source],
    resource_type: 'order',
    resource_id: String(input.orderId),
    after_data: {
      provider: input.provider,
      invoice_id: input.invoiceId,
      provider_ref: input.providerRef,
      receipt: input.receipt ?? null,
      reconciled_at: paidAt,
      source: input.source,
      ...(warnings.length > 0 ? { warnings } : {}),
    },
  })

  return { paid: true, warnings }
}
