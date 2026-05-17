/**
 * POST /api/payhero/payout-webhook?key=<PAYHERO_WEBHOOK_TOKEN>
 *
 * PayHero B2C / withdraw completion callbacks. Body is the same FLAT
 * shape as the inbound payment callback. We look up by
 * `external_reference` which we set to `PO-<payout_id>` at initiation.
 *
 * Security: same URL-token gate as the inbound webhook. PayHero does
 * not sign callbacks.
 *
 * Idempotent — if the payout is already in a terminal state we
 * short-circuit.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  verifyWebhookToken,
  deriveEventId,
} from '@/lib/payhero/service'
import { type PayHeroCallback } from '@/lib/payhero/types'
import { getServerEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET handler for URL-validation pings. See /api/payhero/webhook for details. */
export async function GET(req: NextRequest) {
  const keyOk = verifyWebhookToken(req.nextUrl.searchParams.get('key'))
  return NextResponse.json({
    ok: true,
    hint: 'POST your B2C callback here',
    tokenAccepted: keyOk,
  })
}

export async function POST(req: NextRequest) {
  const receivedKey = req.nextUrl.searchParams.get('key')
  const tokenOk = receivedKey ? verifyWebhookToken(receivedKey) : false

  const rawBody = await req.text()

  let payload: PayHeroCallback
  try {
    payload = JSON.parse(rawBody) as PayHeroCallback
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  if (!payload?.status || !payload.external_reference) {
    return NextResponse.json({ error: 'malformed payload' }, { status: 400 })
  }

  const env = getServerEnv()
  if (!env.ENABLE_PAYOUTS) {
    return NextResponse.json({ ok: true, ignored: 'payouts disabled' })
  }

  const eventId = deriveEventId(payload)
  const externalRef = payload.external_reference
  const service = createServiceClient()

  const dedupRes = (await service.rpc('record_webhook_delivery' as never, {
    p_provider: 'payhero',
    p_event_id: eventId,
    p_event_type: `payout.${payload.status}`,
    p_signature_ok: tokenOk,
    p_body: payload as unknown as Record<string, unknown>,
  } as never)) as { data: boolean | null; error: { message: string } | null }

  if (dedupRes.error) {
    return NextResponse.json(
      { error: 'dedup failed', detail: dedupRes.error.message },
      { status: 500 },
    )
  }
  if (dedupRes.data !== true) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  if (!tokenOk) {
    await markProcessed(service, eventId, 'invalid url token')
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  const payoutIdMatch = /^PO-(\d+)$/.exec(externalRef)
  if (!payoutIdMatch) {
    await markProcessed(service, eventId, `unparseable external_ref: ${externalRef}`)
    return NextResponse.json({ ok: true, unknown: true })
  }
  const payoutId = Number(payoutIdMatch[1])

  // TODO(types): regenerate database.ts post-migration-019.
  const lookup = (await service
    .from('payouts')
    .select('id, status, net_total_minor, provider')
    .eq('id', payoutId)
    .maybeSingle()) as unknown as {
    data: { id: number; status: string; net_total_minor: string | number; provider: string } | null
    error: { message: string } | null
  }
  if (lookup.error || !lookup.data) {
    await markProcessed(service, eventId, `payout ${payoutId} not found`)
    return NextResponse.json({ ok: true, unknown: true })
  }
  const payout = lookup.data

  if (payout.status === 'completed' || payout.status === 'failed') {
    await markProcessed(service, eventId, 'already terminal')
    return NextResponse.json({ ok: true, alreadyTerminal: true })
  }

  const succeeded = payload.status === 'SUCCESS' && payload.success === true
  const mpesaReceipt =
    payload.provider_reference ?? payload.third_party_reference ?? null

  const update = await (service.from('payouts') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
      }
    }
  })
    .update({
      status: succeeded ? 'completed' : 'failed',
      payhero_transfer_reference: payload.reference ?? null,
      payhero_mpesa_receipt: mpesaReceipt,
      completed_at: succeeded ? new Date().toISOString() : null,
      failure_reason: succeeded ? null : (payload as unknown as { message?: string }).message ?? payload.status,
    })
    .eq('id', payoutId)
    .eq('status', 'processing')

  if (update.error) {
    await markProcessed(service, eventId, `update failed: ${update.error.message}`)
    return NextResponse.json({ error: update.error.message }, { status: 500 })
  }

  await service.from('audit_log').insert({
    action: succeeded ? 'payout.completed' : 'payout.failed',
    resource_type: 'payout',
    resource_id: String(payoutId),
    after_data: {
      provider: 'payhero',
      reference: payload.reference ?? null,
      mpesa_receipt: mpesaReceipt,
    },
  })

  await markProcessed(service, eventId, null)
  return NextResponse.json({ ok: true, succeeded })
}

async function markProcessed(
  service: ReturnType<typeof createServiceClient>,
  eventId: string,
  error: string | null,
): Promise<void> {
  await service.rpc('mark_webhook_processed' as never, {
    p_provider: 'payhero',
    p_event_id: eventId,
    p_error: error,
  } as never)
}
