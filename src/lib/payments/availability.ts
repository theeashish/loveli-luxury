/**
 * Provider availability — is the payment dispatcher ready to fire?
 *
 * Pure presence-check against the env validator's parsed result. Does NOT
 * touch the network, does NOT consult the dispatcher, does NOT throw —
 * suitable for server components rendering checkout/signup forms that
 * need to render a graceful "payments are being upgraded" banner during
 * the IntaSend cutover window instead of letting /api/checkout/init
 * surface as a 502 to a user with a cart.
 *
 * The banner appears in two situations during the migration window:
 *   1. Phase 0 deploys have landed but the owner has not yet set the
 *      INTASEND_* env vars in Vercel.
 *   2. Phase 1+ deploys have landed but the IntaSend dashboard webhook
 *      challenge value does not yet match `INTASEND_WEBHOOK_CHALLENGE`
 *      (we can't detect this from env alone, but the user-visible
 *      symptom — orders never flip paid — is the same).
 *
 * Health: /api/health?deep=1 surfaces a more granular per-env-var
 * breakdown for operators. This helper is the binary version for
 * UI rendering.
 */

import 'server-only'

import { getServerEnv } from '../env'

export type ProviderAvailability =
  | { ok: true; provider: 'intasend' }
  | {
      ok: false
      provider: 'intasend'
      /** Human-readable list of missing env keys for the admin/diagnostics page. */
      missing: string[]
      /** UI-safe copy intended to be shown to a customer staring at /checkout. */
      customerMessage: string
    }

/**
 * Returns `ok: true` when every IntaSend env required to actually fire a
 * collection is present. Otherwise returns `ok: false` with the list of
 * missing keys and a customer-safe message.
 *
 * Does NOT reach out to IntaSend — env presence is a strict prerequisite
 * for any network call, so this is a sufficient first gate. The dispatcher
 * itself still validates secret format / wallet existence at call time.
 */
export function paymentProviderAvailability(): ProviderAvailability {
  const env = getServerEnv()

  const required = [
    ['INTASEND_PUBLISHABLE_KEY', env.INTASEND_PUBLISHABLE_KEY],
    ['INTASEND_SECRET_TOKEN', env.INTASEND_SECRET_TOKEN],
    ['INTASEND_WALLET_ID', env.INTASEND_WALLET_ID],
    ['INTASEND_WEBHOOK_CHALLENGE', env.INTASEND_WEBHOOK_CHALLENGE],
  ] as const

  const missing = required
    .filter(([, value]) => typeof value !== 'string' || value.length === 0)
    .map(([key]) => key)

  if (missing.length === 0) {
    return { ok: true, provider: 'intasend' }
  }
  return {
    ok: false,
    provider: 'intasend',
    missing,
    customerMessage:
      'Payments are briefly being upgraded. Please try again in a few minutes — your cart will still be here.',
  }
}
