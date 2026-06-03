/**
 * IntaSend webhook signature verification.
 *
 * IntaSend signs webhook payloads by including a `challenge` field in the
 * JSON body — the same value the platform set in the IntaSend dashboard's
 * webhook configuration. Verification means: read the field, compare
 * (timing-safe) against our `INTASEND_WEBHOOK_CHALLENGE` env var, reject
 * on mismatch. Anyone who can read the challenge can forge webhooks, so
 * it lives in Vercel/Supabase secrets and never in client code.
 *
 * From the migration spec (locked 2026-06-03):
 *   "Webhook signature verification mandatory on every webhook. Missing
 *    verification means full project restart, not a patch."
 *
 * This module exists so the verification is in exactly one place, every
 * webhook handler imports it, and a future audit can grep for one symbol
 * to confirm it's actually called everywhere it should be.
 */

import 'server-only'
import { timingSafeEqual } from 'node:crypto'

import { getServerEnv } from '../env'

export type VerifyResult = { ok: true } | { ok: false; reason: string }

/**
 * Verify a webhook body's `challenge` field against the configured
 * `INTASEND_WEBHOOK_CHALLENGE`. Constant-time comparison (no early-exit
 * length-aware match) so a malicious caller cannot infer the challenge
 * value from response timing.
 *
 * Returns a discriminated result rather than throwing so the webhook
 * handler can log + 401 cleanly. A throw at this layer would surface as
 * a 500 in Next's error boundary, which would tell IntaSend to retry —
 * exactly the wrong behaviour for a forged-signature payload.
 */
export function verifyWebhookChallenge(
  bodyChallenge: string | undefined,
): VerifyResult {
  const env = getServerEnv()
  const expected = env.INTASEND_WEBHOOK_CHALLENGE
  if (!expected) {
    return {
      ok: false,
      reason:
        'INTASEND_WEBHOOK_CHALLENGE is unset on the server — webhook verification cannot proceed.',
    }
  }
  if (typeof bodyChallenge !== 'string' || bodyChallenge.length === 0) {
    return { ok: false, reason: 'webhook body did not include a challenge field' }
  }

  // timingSafeEqual REQUIRES equal-length buffers. We pad to the longer
  // of the two so the comparison runs in constant time across all
  // mismatched inputs (otherwise a length mismatch leaks via timing).
  const a = Buffer.from(bodyChallenge, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  const len = Math.max(a.length, b.length)
  const aPad = Buffer.alloc(len)
  const bPad = Buffer.alloc(len)
  a.copy(aPad)
  b.copy(bPad)

  const sameLength = a.length === b.length
  const sameBytes = timingSafeEqual(aPad, bPad)
  if (!sameLength || !sameBytes) {
    return { ok: false, reason: 'challenge mismatch' }
  }
  return { ok: true }
}
