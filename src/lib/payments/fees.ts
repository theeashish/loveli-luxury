/**
 * Provider-neutral processing-fee model.
 *
 * Replaces the PayHero-specific `computePayHeroFeeMinor` that lived in
 * `src/lib/payhero/fees.ts` (deleted 2026-06-03 with the rest of the
 * PayHero integration). The fee math is provider-specific in detail
 * (IntaSend charges a flat-plus-percent, with a different rate for STK
 * vs card vs bank), but the SHAPE — "given an order subtotal, return the
 * processing-fee component in minor units" — is provider-agnostic.
 *
 * Phase 0 (2026-06-03): returns 0 — no fee modelled until the IntaSend
 * fee schedule is wired in Phase 1 (`src/lib/intasend/fees.ts`). The
 * checkout summary surfaces `KES 0.00` for "Processing fee" until then,
 * which is correct: the customer is not being charged a phantom fee.
 *
 * When Phase 1 lands, the implementation will read the IntaSend pricing
 * (currently 1.5% + KES 5 per M-Pesa transaction, capped at KES 250 for
 * the Loveli account, subject to confirmation against the IntaSend
 * dashboard) and return the cents owed to the provider on top of the
 * subtotal. The customer always pays subtotal + fee; the platform's
 * float wallet receives the subtotal after IntaSend's deduction.
 */

// Pure math — safe on client OR server. The client uses it to render the
// cart summary; the checkout API re-runs it server-side as the
// authoritative source of truth.

/**
 * Processing fee in minor units (cents) for an order of the given subtotal.
 *
 * `subtotalMinor` is the cart subtotal in cents. Returns a non-negative
 * bigint representing the fee the customer pays on top of subtotal.
 *
 * Phase 0 stub: returns 0n. Phase 1 plugs in the IntaSend fee schedule.
 */
export function computeProcessingFeeMinor(subtotalMinor: bigint): bigint {
  void subtotalMinor
  return 0n
}
