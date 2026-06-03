/**
 * Idempotency decision helpers for the checkout-init / signup-init STK
 * push path. Provider-neutral — the same logic applies to PayHero (now
 * retired) and IntaSend.
 *
 * Extracted into a pure-function module so the decision logic is
 * testable without mocking the Supabase chain. The init routes call
 * `decidePendingAction` after looking up the user's most recent
 * pending order, and `shouldRefireStk` after looking up the order's
 * most recent stk_push payment_attempt.
 *
 * No I/O. No imports beyond types. Times in ms throughout.
 *
 * History: this lived in `src/lib/payhero/idempotency.ts` until
 * 2026-06-03; moved to `payments/` (provider-neutral) as part of the
 * PayHero → IntaSend cutover. Behaviour unchanged.
 */

/** A row shape narrow enough to make decisions on. The init routes
 *  pass in just these three columns from their `orders` lookup. */
export interface PendingOrderRow {
  id: number
  order_number: string
  /** ISO 8601 timestamp. */
  created_at: string
}

/** Outcome of consulting `decidePendingAction`. */
export type PendingAction =
  /** No pending order — proceed to fresh insert. */
  | { type: 'none' }
  /** Pending order is still live within the reuse window — refire STK
   *  against it (subject to the refire throttle) rather than creating
   *  a second order. */
  | { type: 'reuse'; orderId: number; orderNumber: string }
  /** Pending order has aged past the reuse window — flip it to
   *  'expired' so the partial unique index releases its slot, then
   *  proceed to fresh insert. */
  | { type: 'expire'; orderId: number }

/**
 * Decide whether to reuse, expire, or ignore a pending order on init.
 *
 * @param pending        the most recent pending order for the user, or null
 * @param nowMs          current epoch ms (injected for testability)
 * @param staleAfterMs   how long a pending order may live before it's
 *                       considered abandoned and ready to expire
 */
export function decidePendingAction(
  pending: PendingOrderRow | null,
  nowMs: number,
  staleAfterMs: number,
): PendingAction {
  if (!pending) return { type: 'none' }
  const createdMs = new Date(pending.created_at).getTime()
  const ageMs = nowMs - createdMs
  if (ageMs < staleAfterMs) {
    return {
      type: 'reuse',
      orderId: pending.id,
      orderNumber: pending.order_number,
    }
  }
  return { type: 'expire', orderId: pending.id }
}

/**
 * Decide whether to actually re-fire an STK push during the reuse
 * branch. Within the Daraja STK push lifetime (60s), the prior prompt
 * is still live on the customer's phone — firing again would just
 * incur a second wallet fee with no UX gain.
 *
 * @param lastAttemptIso  ISO timestamp of the most recent stk_push
 *                        payment_attempt for this order, or null
 * @param nowMs           current epoch ms (injected for testability)
 * @param throttleMs      window during which a fresh fire is suppressed
 */
export function shouldRefireStk(
  lastAttemptIso: string | null,
  nowMs: number,
  throttleMs: number,
): boolean {
  if (!lastAttemptIso) return true
  const ageMs = nowMs - new Date(lastAttemptIso).getTime()
  return ageMs >= throttleMs
}
