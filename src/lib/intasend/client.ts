/**
 * IntaSend SDK singleton.
 *
 * Server-only. The publishable + secret keys live in Vercel/Supabase env;
 * this module validates they're set and returns a memoised SDK instance.
 * `INTASEND_TEST=true` routes through sandbox.intasend.com; anything else
 * is live (deliberately fail-closed — a missing flag must NOT silently
 * downgrade prod to sandbox).
 *
 * Phase 1 (2026-06-03) of the PayHero → IntaSend migration. Phase 2
 * (collect endpoint + webhook) consumes this client. Phase 4 (payouts)
 * extends consumption.
 */

import 'server-only'

import IntaSend from 'intasend-node'
import { getServerEnv } from '../env'

let _client: IntaSend | null = null

/**
 * Lazy singleton — first call validates env and constructs the SDK; later
 * calls return the same instance. This avoids the cost of re-validating
 * env on every request and lets the dispatcher fail loudly at the route
 * boundary rather than inside a deep import.
 */
export function getIntasend(): IntaSend {
  if (_client !== null) return _client
  const env = getServerEnv()

  if (!env.INTASEND_PUBLISHABLE_KEY) {
    throw new Error(
      'INTASEND_PUBLISHABLE_KEY is unset — collect/payout endpoints cannot fire.',
    )
  }
  if (!env.INTASEND_SECRET_TOKEN) {
    throw new Error(
      'INTASEND_SECRET_TOKEN is unset — collect/payout endpoints cannot fire.',
    )
  }

  // Third arg is `test_mode` (boolean). Sandbox routing is controlled
  // here, NOT by environment variables inside the SDK.
  _client = new IntaSend(
    env.INTASEND_PUBLISHABLE_KEY,
    env.INTASEND_SECRET_TOKEN,
    env.INTASEND_TEST === true,
  )
  return _client
}

/**
 * The wallet id the platform uses as a float account. Collections fund it;
 * payouts draw from it. Read here so callers don't repeat the env lookup.
 */
export function getFloatWalletId(): string {
  const env = getServerEnv()
  if (!env.INTASEND_WALLET_ID) {
    throw new Error('INTASEND_WALLET_ID is unset — wallet routing unavailable.')
  }
  return env.INTASEND_WALLET_ID
}

/**
 * Test-only: clear the memoised client so a test can re-init with a
 * different env. NOT for production code paths.
 */
export function __resetIntasendClientForTesting(): void {
  _client = null
}
