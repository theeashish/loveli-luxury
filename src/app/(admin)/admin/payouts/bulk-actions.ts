'use server'

/**
 * Bulk-fire admin action for pending payouts.
 *
 * Today every payout is fired one click at a time on /admin/payouts/[id].
 * That is the right default while the operator is gaining trust in the
 * money path, but at 50+ partners it becomes a workflow tax.
 *
 * This action processes every `pending` payout that passes ALL the same
 * per-payout safety gates the single-fire action uses:
 *
 *   - ENABLE_PAYOUTS feature flag must be true
 *   - distributor.payout_msisdn must be non-null
 *   - distributor.payout_msisdn_verified_at must be set
 *   - distributor.payout_msisdn must equal the payout's payout_msisdn
 *     (no MSISDN drift since draft)
 *   - the row must currently be status='pending' (optimistic CAS)
 *
 * It does NOT skip any of these gates, does NOT lower the bar, and does
 * NOT batch the PayHero API call (each fire is independent). Each
 * pending row is processed in sequence; a failure on one row rolls THAT
 * ROW back to 'pending' and continues with the next. The aggregate
 * result reports every outcome.
 *
 * Audit: same audit_log writes as the per-payout action, one per fire.
 *
 * Authorization: superadmin only. A regular admin can still fire payouts
 * one at a time, but the bulk fire is gated higher because mistakes
 * scale faster.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSuperadmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { initiateB2C, buildCallbackUrl } from '@/lib/payhero/service'
import { publicEnv, getServerEnv } from '@/lib/env'

export type BulkFireOutcome =
  | { payoutId: number; status: 'fired'; reference: string | null; amountKes: number }
  | {
      payoutId: number
      status: 'skipped'
      reason:
        | 'not_pending'
        | 'no_msisdn'
        | 'msisdn_not_verified'
        | 'msisdn_drift'
    }
  | { payoutId: number; status: 'failed'; error: string }

export type BulkFireResult =
  | {
      ok: true
      summary: { fired: number; skipped: number; failed: number; total: number }
      outcomes: BulkFireOutcome[]
    }
  | { ok: false; error: string }

const bodySchema = z
  .object({
    /** Optional safety cap. Defaults to 100; an operator can lower it
     *  to 5 for the first real run and ratchet up once trusted. */
    maxFires: z.coerce.number().int().positive().max(500).optional(),
    /**
     * Optional explicit payout-id allowlist (for the multi-select UX).
     * If absent, every eligible pending payout is processed up to maxFires.
     */
    payoutIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
  })
  .strict()
  .default({})

type DistVerifyRow = {
  payout_msisdn: string | null
  payout_msisdn_verified_at: string | null
}

type PayoutRow = {
  id: number
  distributor_id: number
  status: string
  net_total_minor: string | number
  payout_msisdn: string | null
}

export async function fireAllEligiblePayouts(
  raw: { maxFires?: number; payoutIds?: number[] } = {},
): Promise<BulkFireResult> {
  let session
  try {
    session = await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden — superadmin required' }
    throw err
  }

  const env = getServerEnv()
  if (!env.ENABLE_PAYOUTS) {
    return { ok: false, error: 'Payouts are disabled. Set ENABLE_PAYOUTS=true to proceed.' }
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Invalid request' }
  const maxFires = parsed.data.maxFires ?? 100
  const explicitIds = parsed.data.payoutIds ?? null

  const service = createServiceClient()

  // Load the candidate pending payouts in one round-trip.
  let pendingRes
  if (explicitIds && explicitIds.length > 0) {
    pendingRes = await service
      .from('payouts')
      .select('id, distributor_id, status, net_total_minor, payout_msisdn')
      .in('id', explicitIds)
      .eq('status', 'pending')
      .order('id', { ascending: true })
  } else {
    pendingRes = await service
      .from('payouts')
      .select('id, distributor_id, status, net_total_minor, payout_msisdn')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .limit(maxFires)
  }
  if (pendingRes.error) {
    return { ok: false, error: `Could not load pending payouts: ${pendingRes.error.message}` }
  }
  const candidates = ((pendingRes.data ?? []) as PayoutRow[]).slice(0, maxFires)

  if (candidates.length === 0) {
    return {
      ok: true,
      summary: { fired: 0, skipped: 0, failed: 0, total: 0 },
      outcomes: [],
    }
  }

  // Resolve distributor verification state for every candidate in one
  // round-trip — avoids N round-trips inside the firing loop.
  const distributorIds = Array.from(new Set(candidates.map((p) => p.distributor_id)))
  const distRes = await service
    .from('distributors')
    .select('id, payout_msisdn, payout_msisdn_verified_at')
    .in('id', distributorIds)
  if (distRes.error) {
    return { ok: false, error: `Could not load distributor verification: ${distRes.error.message}` }
  }
  const distById = new Map<number, DistVerifyRow>(
    ((distRes.data ?? []) as Array<{ id: number } & DistVerifyRow>).map((d) => [
      d.id,
      { payout_msisdn: d.payout_msisdn, payout_msisdn_verified_at: d.payout_msisdn_verified_at },
    ]),
  )

  const outcomes: BulkFireOutcome[] = []

  for (const row of candidates) {
    if (!row.payout_msisdn) {
      outcomes.push({ payoutId: row.id, status: 'skipped', reason: 'no_msisdn' })
      continue
    }
    const dv = distById.get(row.distributor_id)
    if (!dv || !dv.payout_msisdn_verified_at) {
      outcomes.push({ payoutId: row.id, status: 'skipped', reason: 'msisdn_not_verified' })
      continue
    }
    if (dv.payout_msisdn !== row.payout_msisdn) {
      outcomes.push({ payoutId: row.id, status: 'skipped', reason: 'msisdn_drift' })
      continue
    }

    // Optimistic-lock the row pending → processing. The .eq('status','pending')
    // makes this safe under concurrent bulk-fire clicks: only ONE caller
    // gets the row.
    const lockRes = await service
      .from('payouts')
      .update({ status: 'processing', initiated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (lockRes.error || !lockRes.data) {
      outcomes.push({ payoutId: row.id, status: 'skipped', reason: 'not_pending' })
      continue
    }

    const amountKes = Number(BigInt(row.net_total_minor) / 100n)

    try {
      const callbackUrl = buildCallbackUrl(
        publicEnv.NEXT_PUBLIC_APP_URL,
        '/api/payhero/payout-webhook',
      )
      const transfer = await initiateB2C({
        amountKes,
        phone: row.payout_msisdn,
        payoutId: row.id,
        callbackUrl,
        customerName: `Loveli distributor ${row.id}`,
      })

      await (
        service.from('payouts') as unknown as {
          update: (v: Record<string, unknown>) => {
            eq: (col: string, val: unknown) => Promise<{
              error: { message: string } | null
            }>
          }
        }
      )
        .update({
          provider: 'payhero',
          payhero_transfer_reference: transfer.reference ?? null,
        })
        .eq('id', row.id)

      await service.from('audit_log').insert({
        actor_id: session.userId,
        action: 'payout.initiated.bulk',
        resource_type: 'payouts',
        resource_id: String(row.id),
        after_data: {
          provider: 'payhero',
          payhero_reference: transfer.reference ?? null,
          amount_kes: amountKes,
          msisdn: row.payout_msisdn,
          bulk_run: true,
        },
      })

      outcomes.push({
        payoutId: row.id,
        status: 'fired',
        reference: transfer.reference ?? null,
        amountKes,
      })
    } catch (err) {
      // Roll the row back to pending so the operator (or a retry) can fire it.
      await service
        .from('payouts')
        .update({
          status: 'pending',
          initiated_at: null,
          failure_reason: (err as Error).message,
        })
        .eq('id', row.id)
      outcomes.push({ payoutId: row.id, status: 'failed', error: (err as Error).message })
    }
  }

  const fired = outcomes.filter((o) => o.status === 'fired').length
  const skipped = outcomes.filter((o) => o.status === 'skipped').length
  const failed = outcomes.filter((o) => o.status === 'failed').length

  revalidatePath('/admin/payouts')
  return {
    ok: true,
    summary: { fired, skipped, failed, total: outcomes.length },
    outcomes,
  }
}
