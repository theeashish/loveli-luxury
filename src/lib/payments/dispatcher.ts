/**
 * Payment dispatcher.
 *
 * After the Flutterwave → PayHero migration, PayHero is the only
 * supported provider. This module remains as a thin abstraction so a
 * future second provider can be added by introducing a new branch
 * without ripping up callers.
 *
 * Audit-logging contract: writes to payment_attempts are best-effort.
 * That table exists from migration 019; if it ever fails (RLS,
 * temporary outage), payment initiation still succeeds.
 */

import 'server-only'

import { publicEnv } from '../env'
import { initiateStkPush, buildCallbackUrl } from '../payhero/service'
import { createServiceClient } from '../supabase/service'

export type PaymentProvider = 'payhero'

export function getCurrentProvider(): PaymentProvider {
  return 'payhero'
}

export interface InitiatePaymentArgs {
  orderId: number
  orderNumber: string
  amountKes: number
  customer: {
    email: string
    name: string
    phone: string // E.164 (+254...)
  }
  description: string
}

export interface InitiatePaymentResult {
  provider: PaymentProvider
  /** PayHero internal reference (phc_*). Frontend polls /api/payhero/status. */
  checkoutReference?: string
  /** Lifecycle hint for the frontend. */
  status?: 'stk_pushed' | 'queued'
}

/**
 * Best-effort audit insert. Swallows any error.
 */
async function logAttempt(
  service: ReturnType<typeof createServiceClient>,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    await (
      service.from('payment_attempts' as never) as unknown as {
        insert: (
          v: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>
      }
    ).insert(row)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[dispatcher] payment_attempts insert skipped:',
      (e as Error).message,
    )
  }
}

/**
 * Best-effort order column update.
 */
async function updateOrderProviderRefs(
  service: ReturnType<typeof createServiceClient>,
  orderId: number,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    await (
      service.from('orders') as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (col: string, val: unknown) => Promise<{
            error: { message: string } | null
          }>
        }
      }
    )
      .update(patch)
      .eq('id', orderId)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      '[dispatcher] order column update skipped:',
      (e as Error).message,
    )
  }
}

export async function initiatePayment(
  args: InitiatePaymentArgs,
): Promise<InitiatePaymentResult> {
  const service = createServiceClient()

  const callbackUrl = buildCallbackUrl(
    publicEnv.NEXT_PUBLIC_APP_URL,
    '/api/payhero/webhook',
  )

  try {
    const r = await initiateStkPush({
      amountKes: args.amountKes,
      phone: args.customer.phone,
      orderNumber: args.orderNumber,
      customerName: args.customer.name,
      callbackUrl,
    })

    await updateOrderProviderRefs(service, args.orderId, {
      payment_provider: 'payhero',
      payhero_checkout_reference: r.reference ?? r.CheckoutRequestID ?? null,
    })

    await logAttempt(service, {
      order_id: args.orderId,
      provider: 'payhero',
      attempt_type: 'stk_push',
      request_payload: {
        amountKes: args.amountKes,
        phone: args.customer.phone,
        orderNumber: args.orderNumber,
      },
      response_payload: r as unknown as Record<string, unknown>,
      status: r.success ? 'initiated' : 'failed',
    })

    return {
      provider: 'payhero',
      checkoutReference: r.reference ?? r.CheckoutRequestID,
      status: 'stk_pushed',
    }
  } catch (e) {
    await logAttempt(service, {
      order_id: args.orderId,
      provider: 'payhero',
      attempt_type: 'stk_push',
      status: 'error',
      error_message: (e as Error).message,
    })
    throw e
  }
}
