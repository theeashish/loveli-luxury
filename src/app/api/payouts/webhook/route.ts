/**
 * POST /api/payouts/webhook
 *
 * Flutterwave Transfer events. Body shape (relevant fields only):
 *   { event: 'transfer.completed' | 'transfer.failed',
 *     data: { id: number, status: 'SUCCESSFUL' | 'FAILED', reference: string,
 *             complete_message?: string } }
 *
 * Lookup is by `flutterwave_transfer_id`. We accept an idempotent re-delivery
 * by short-circuiting if the row is already in a terminal state.
 *
 * If ENABLE_PAYOUTS is off (e.g. somebody hit the URL while disabled), we
 * still verify the signature for hygiene but acknowledge without writing —
 * Flutterwave will not retry.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { verifyWebhookSignature } from '@/lib/flutterwave/service'
import { getServerEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface TransferEvent {
  event?: string
  data?: {
    id?: number
    status?: string
    reference?: string
    complete_message?: string
  }
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSignature(req.headers.get('verif-hash'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const env = getServerEnv()
  if (!env.ENABLE_PAYOUTS) {
    return NextResponse.json({ ok: true, ignored: 'payouts disabled' })
  }

  let body: TransferEvent
  try {
    body = (await req.json()) as TransferEvent
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const event = body.event ?? ''
  const data = body.data
  if (!data?.id || !/^transfer\./i.test(event)) {
    return NextResponse.json({ ok: true, ignored: event || 'no data' })
  }

  const service = createServiceClient()
  const lookup = await service
    .from('payouts')
    .select('id, status')
    .eq('flutterwave_transfer_id', String(data.id))
    .maybeSingle()
  if (lookup.error) {
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 })
  }
  const payout = lookup.data as { id: number; status: string } | null
  if (!payout) {
    return NextResponse.json({ ok: true, ignored: 'transfer id unknown' })
  }

  // Idempotency: if already in a terminal state, ack and exit.
  if (payout.status === 'completed' || payout.status === 'failed') {
    return NextResponse.json({ ok: true, ignored: 'terminal' })
  }

  const now = new Date().toISOString()
  if (data.status === 'SUCCESSFUL') {
    await service
      .from('payouts')
      .update({ status: 'completed', completed_at: now, failure_reason: null })
      .eq('id', payout.id)
      .eq('status', 'processing')
    await service.from('audit_log').insert({
      action: 'payout.completed',
      resource_type: 'payouts',
      resource_id: String(payout.id),
      after_data: { transfer_id: data.id },
    })
  } else if (data.status === 'FAILED') {
    await service
      .from('payouts')
      .update({
        status: 'failed',
        failure_reason: data.complete_message ?? 'Flutterwave reported FAILED',
      })
      .eq('id', payout.id)
      .eq('status', 'processing')
    await service.from('audit_log').insert({
      action: 'payout.failed',
      resource_type: 'payouts',
      resource_id: String(payout.id),
      after_data: { transfer_id: data.id, reason: data.complete_message ?? null },
    })
  } else {
    return NextResponse.json({ ok: true, ignored: `unknown status ${data.status}` })
  }

  try {
    revalidatePath('/admin/payouts')
    revalidatePath(`/admin/payouts/${payout.id}`)
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true })
}
