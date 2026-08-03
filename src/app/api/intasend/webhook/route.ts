/**
 * POST /api/intasend/webhook
 *
 * Receives IntaSend's collection, send-money, and chargeback events (the
 * one destination URL configured in the IntaSend dashboard handles all
 * three — see developers.intasend.com/docs/webhooks). This is Phase 2 of
 * the PayHero → IntaSend migration; `src/lib/intasend/signature.ts` and
 * the `record_webhook_delivery` / `mark_webhook_processed` RPCs
 * (migration 019) were built ahead of this route and had zero callers
 * until now.
 *
 * Response codes:
 *   200 — verified and processed (or a verified duplicate — ack, no-op)
 *   401 — challenge missing/invalid; NOT recorded as a successful delivery
 *   400 — body isn't valid JSON, or doesn't match any known event shape
 *   500 — genuinely unexpected server error (DB down, etc.) — IntaSend
 *         will retry per its documented backoff (5 retries: ~5m, 20m, ...)
 *
 * We deliberately do NOT rate-limit by the caller's identity the way
 * `/api/checkout/init` does — the challenge check IS the auth boundary
 * here, verified before any DB write. A generic IP-based cap would let
 * an attacker who doesn't know the challenge cheaply exhaust it against
 * legitimate IntaSend traffic (shared egress IPs). A light global cap
 * still guards against gross flooding without depending on caller identity.
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { processIntasendWebhook } from '@/lib/intasend/webhook-handler'
import { WebhookVerificationError } from '@/lib/payments/errors'
import { checkRateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Global flood guard — generous, since legitimate volume (collections +
  // payouts + chargebacks) all land here. Fails open if Upstash isn't
  // configured, matching every other rate-limited route in this codebase.
  const limit = await checkRateLimit('intasend-webhook', 'global', {
    limit: 600,
    windowSeconds: 60,
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    const result = await processIntasendWebhook(service, body)
    return NextResponse.json({
      ok: true,
      kind: result.kind,
      isNew: result.isNew,
      applied: result.applied,
      warnings: result.warnings,
    })
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      // eslint-disable-next-line no-console
      console.warn('[intasend/webhook] verification failed:', e.message)
      return NextResponse.json({ error: 'verification failed' }, { status: 401 })
    }
    // eslint-disable-next-line no-console
    console.error('[intasend/webhook] unexpected error:', (e as Error).message)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
