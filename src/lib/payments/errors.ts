/**
 * Typed errors for the payment abstraction layer.
 *
 * Every error carries a `code` (stable, machine-checkable) and optional
 * `context` (safe-to-log metadata — never raw secrets, never full card /
 * M-Pesa PII). Route handlers catch on `instanceof` to decide HTTP status
 * and whether to retry; callers should not need to parse `.message`.
 *
 * These are intentionally provider-agnostic — a future provider throws
 * the same error classes, not IntaSend-specific ones, so business logic
 * (checkout, payouts, admin refunds) never has to branch on provider.
 */

export type PaymentErrorContext = Record<string, unknown>

abstract class PaymentError extends Error {
  abstract readonly code: string

  constructor(
    message: string,
    public readonly context?: PaymentErrorContext,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** Thrown when a payment (collection) could not be initiated with the provider. */
export class PaymentInitializationError extends PaymentError {
  readonly code = 'PAYMENT_INITIALIZATION_ERROR'
}

/** Thrown when a payment's status could not be confirmed with the provider. */
export class PaymentVerificationError extends PaymentError {
  readonly code = 'PAYMENT_VERIFICATION_ERROR'
}

/** Thrown when an inbound webhook fails signature / challenge verification. */
export class WebhookVerificationError extends PaymentError {
  readonly code = 'WEBHOOK_VERIFICATION_ERROR'
}

/** Thrown when a payout (B2C disbursement) could not be initiated, approved, or its status resolved. */
export class PayoutError extends PaymentError {
  readonly code = 'PAYOUT_ERROR'
}

/** Thrown when a refund/chargeback could not be created with the provider. */
export class RefundError extends PaymentError {
  readonly code = 'REFUND_ERROR'
}

/** Thrown when required provider configuration (env vars) is missing or invalid. */
export class ConfigurationError extends PaymentError {
  readonly code = 'CONFIGURATION_ERROR'
}

/** Thrown when caller-supplied input fails validation before it would reach the provider. */
export class ValidationError extends PaymentError {
  readonly code = 'VALIDATION_ERROR'
}

/** Thrown when the underlying HTTP call to the provider fails at the transport level. */
export class NetworkError extends PaymentError {
  readonly code = 'NETWORK_ERROR'
}

/** Thrown when a provider call exceeds its allotted timeout. */
export class TimeoutError extends PaymentError {
  readonly code = 'TIMEOUT_ERROR'
}

/** True for any error defined in this module — useful for a single catch-all boundary. */
export function isPaymentError(err: unknown): err is PaymentError {
  return (
    err instanceof PaymentInitializationError ||
    err instanceof PaymentVerificationError ||
    err instanceof WebhookVerificationError ||
    err instanceof PayoutError ||
    err instanceof RefundError ||
    err instanceof ConfigurationError ||
    err instanceof ValidationError ||
    err instanceof NetworkError ||
    err instanceof TimeoutError
  )
}
