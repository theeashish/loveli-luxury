/**
 * IntaSendProvider — implements `PaymentProvider` (provider.ts).
 *
 * Deliberately a THIN WRAPPER, not a rewrite:
 *   - initializePayment  → delegates to the existing `dispatcher.initiatePayment`
 *   - verifyPayment      → new: calls `collection.status()` (documented,
 *                          previously unused — Phase 2 was deferred)
 *   - handleWebhook       → new: delegates to `intasend/webhook-handler.ts`
 *   - initiatePayout / approvePayout → new: delegates to `intasend/payouts.ts`
 *   - refundPayment       → new: delegates to `intasend/refunds.ts`
 *
 * Nothing that already worked (collection STK push, the post-success
 * chain) was reimplemented here — this class just gives the existing
 * functions a name a second provider could also answer to.
 */

import 'server-only'

import { getIntasend } from '../intasend/client'
import { collectionStatusSchema, intasendStateToPaymentStatus } from '../intasend/types'
import { initiatePayment as dispatcherInitiatePayment } from './dispatcher'
import { processIntasendWebhook } from '../intasend/webhook-handler'
import {
  initiateIntasendB2C,
  approveIntasendB2C,
} from '../intasend/payouts'
import { createIntasendRefund } from '../intasend/refunds'
import { createServiceClient } from '../supabase/service'
import {
  PaymentInitializationError,
  PaymentVerificationError,
  TimeoutError,
} from './errors'
import type {
  PaymentProvider,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentResult,
  HandleWebhookInput,
  HandleWebhookResult,
  InitiatePayoutInput,
  InitiatePayoutResult,
  ApprovePayoutInput,
  ApprovePayoutResult,
  RefundPaymentInput,
  RefundPaymentResult,
} from './provider'

const VERIFY_CALL_TIMEOUT_MS = 15_000

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${VERIFY_CALL_TIMEOUT_MS}ms`)),
      VERIFY_CALL_TIMEOUT_MS,
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

export class IntaSendProvider implements PaymentProvider {
  readonly name = 'intasend' as const

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    try {
      return await dispatcherInitiatePayment(input)
    } catch (e) {
      if (e instanceof PaymentInitializationError) throw e
      throw new PaymentInitializationError((e as Error).message, { orderId: input.orderId })
    }
  }

  async verifyPayment(invoiceId: string): Promise<VerifyPaymentResult> {
    const intasend = getIntasend()
    const collection = intasend.collection() as unknown as {
      status: (invoiceId: string) => Promise<unknown>
    }

    let raw: unknown
    try {
      raw = await withTimeout('IntaSend payment status', collection.status(invoiceId))
    } catch (e) {
      if (e instanceof TimeoutError) throw e
      throw new PaymentVerificationError(`IntaSend status check failed: ${(e as Error).message}`, {
        invoiceId,
      })
    }

    const parsed = collectionStatusSchema.safeParse(raw)
    if (!parsed.success) {
      throw new PaymentVerificationError(
        `IntaSend returned an unexpected status shape: ${parsed.error.message}`,
        { invoiceId },
      )
    }

    const { invoice } = parsed.data
    return {
      provider: 'intasend',
      invoiceId: invoice.invoice_id,
      state: intasendStateToPaymentStatus(invoice.state),
      providerRef: invoice.mpesa_reference ?? invoice.invoice_id,
      mpesaReceipt: invoice.mpesa_reference ?? null,
      failedReason: invoice.failed_reason ?? null,
      raw: parsed.data as Record<string, unknown>,
    }
  }

  async handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult> {
    const service = createServiceClient()
    const result = await processIntasendWebhook(service, input.body)
    return result
  }

  async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    const result = await initiateIntasendB2C({
      payoutId: input.payoutId,
      amountKes: input.amountKes,
      msisdn: input.msisdn,
      beneficiaryName: input.beneficiaryName,
      narrative: input.narrative,
    })
    return {
      provider: 'intasend',
      trackingId: result.trackingId,
      status: result.status,
      raw: result.raw,
    }
  }

  async approvePayout(input: ApprovePayoutInput): Promise<ApprovePayoutResult> {
    const result = await approveIntasendB2C(input.payoutId, input.raw)
    return { provider: 'intasend', trackingId: result.trackingId, raw: result.raw }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const result = await createIntasendRefund({
      orderId: input.orderId,
      invoiceId: input.invoiceId,
      amountKes: input.amountKes,
      reason: input.reason,
      reasonDetails: input.reasonDetails,
    })
    return { provider: 'intasend', chargebackId: result.chargebackId, raw: result.raw }
  }
}
