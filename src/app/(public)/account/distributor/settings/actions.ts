'use server'

/**
 * Distributor self-service settings actions.
 *
 *   submitPayoutMsisdnChange — distributor proposes a new payout MSISDN.
 *   The new value lands in payout_msisdn_pending and the existing
 *   verification stamp is cleared. We then mint a 6-digit code, store
 *   its hash in msisdn_verifications, and send the plaintext over SMS
 *   (Phase 7 wave 4). The distributor verifies on
 *   /account/distributor/settings/verify. Admin can still approve
 *   manually from /admin/distributors/verifications as a fallback.
 *
 *   confirmMsisdnCode — verifies the entered code against the stored
 *   hash. On match, flips payout_msisdn to pending value, stamps
 *   verified_at, clears pending. Audit-logged.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSMS } from '@/lib/sms/send'
import {
  CODE_TTL_MINUTES,
  MAX_VERIFICATION_ATTEMPTS,
  compareCodeHash,
  generateCode,
  hashCode,
} from '@/lib/sms/codes'

const phoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Phone must be E.164, e.g. +254712345678')

const inputSchema = z.object({
  msisdn: phoneSchema,
})

export async function submitPayoutMsisdnChange(formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const parsed = inputSchema.safeParse({ msisdn: formData.get('msisdn') })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid number')
  }
  const { msisdn } = parsed.data

  const service = createServiceClient()

  const distRes = await service
    .from('distributors')
    .select('id, payout_msisdn, payout_msisdn_pending')
    .eq('user_id', user.id)
    .maybeSingle()
  const dist = distRes.data as
    | {
        id: number
        payout_msisdn: string | null
        payout_msisdn_pending: string | null
      }
    | null
  if (!dist) throw new Error('Distributor record not found')

  // No-ops kept silent; the user just sees the form re-render.
  if (dist.payout_msisdn === msisdn && dist.payout_msisdn_pending === null) {
    revalidatePath('/account/distributor/settings')
    return
  }
  if (dist.payout_msisdn_pending === msisdn) {
    revalidatePath('/account/distributor/settings')
    return
  }

  const upd = await service
    .from('distributors')
    .update({
      payout_msisdn_pending: msisdn,
      payout_msisdn_pending_at: new Date().toISOString(),
      // Clear the existing verification so Phase 5's payout-init guard
      // refuses to fire. Old number can still be re-verified by the admin
      // overriding via direct DB if needed.
      payout_msisdn_verified_at: null,
    })
    .eq('id', dist.id)
  if (upd.error) {
    throw new Error(`Could not save: ${upd.error.message}`)
  }

  // Mint a one-time code + send over SMS. We delete any prior unused
  // verification row first (the partial UNIQUE index allows only one
  // active per distributor).
  const code = generateCode()
  const codeHash = hashCode(code, msisdn)
  const expiresAt = new Date(
    Date.now() + CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString()

  await service
    .from('msisdn_verifications')
    .delete()
    .eq('distributor_id', dist.id)
    .is('used_at', null)

  const insVer = await service
    .from('msisdn_verifications')
    .insert({
      distributor_id: dist.id,
      msisdn,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (insVer.error) {
    throw new Error(
      `Could not start verification: ${insVer.error.message}`,
    )
  }

  try {
    await sendSMS({
      msisdn,
      body:
        `Loveli Luxury verification code: ${code}. ` +
        `Expires in ${CODE_TTL_MINUTES} minutes. Do not share.`,
      category: 'msisdn_verification',
    })
  } catch (err) {
    // Don't throw — the pending row is set and admin can verify manually.
    // Surface via audit_log so it's visible.
    await service.from('audit_log').insert({
      action: 'sms.send_failed',
      resource_type: 'msisdn_verifications',
      resource_id: String(insVer.data.id),
      after_data: { error: (err as Error).message, msisdn },
    })
  }

  await service.from('audit_log').insert({
    actor_id: user.id,
    action: 'distributor.msisdn_change_requested',
    resource_type: 'distributors',
    resource_id: String(dist.id),
    before_data: { payout_msisdn: dist.payout_msisdn },
    after_data: { payout_msisdn_pending: msisdn },
  })

  revalidatePath('/account/distributor/settings')
  revalidatePath('/account/distributor')
  redirect('/account/distributor/settings/verify')
}

// ---------------------------------------------------------------------------
// confirmMsisdnCode — distributor enters the SMS code
// ---------------------------------------------------------------------------

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
})

export async function confirmMsisdnCode(formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const parsed = codeSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid code')
  }
  const { code } = parsed.data

  const service = createServiceClient()

  const distRes = await service
    .from('distributors')
    .select('id, payout_msisdn, payout_msisdn_pending')
    .eq('user_id', user.id)
    .maybeSingle()
  const dist = distRes.data as
    | {
        id: number
        payout_msisdn: string | null
        payout_msisdn_pending: string | null
      }
    | null
  if (!dist) throw new Error('Distributor record not found')
  if (!dist.payout_msisdn_pending) {
    throw new Error('No pending MSISDN change to verify')
  }

  const verRes = await service
    .from('msisdn_verifications')
    .select('id, code_hash, expires_at, used_at, attempts, msisdn')
    .eq('distributor_id', dist.id)
    .is('used_at', null)
    .maybeSingle()
  const ver = verRes.data as
    | {
        id: number
        code_hash: string
        expires_at: string
        used_at: string | null
        attempts: number
        msisdn: string
      }
    | null
  if (!ver) {
    throw new Error('No active verification — request a new code')
  }
  if (ver.msisdn !== dist.payout_msisdn_pending) {
    throw new Error('Verification mismatch — request a new code')
  }
  if (new Date(ver.expires_at).getTime() <= Date.now()) {
    throw new Error('Code expired — request a new one')
  }
  if (ver.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    throw new Error('Too many failed attempts — request a new code')
  }

  const expectedHash = hashCode(code, ver.msisdn)
  if (!compareCodeHash(expectedHash, ver.code_hash)) {
    // Increment attempts so brute force is bounded
    await service
      .from('msisdn_verifications')
      .update({ attempts: ver.attempts + 1 })
      .eq('id', ver.id)
    throw new Error('Wrong code')
  }

  // Success: flip the MSISDN onto the distributor + stamp verification.
  const now = new Date().toISOString()
  await service
    .from('distributors')
    .update({
      payout_msisdn: ver.msisdn,
      payout_msisdn_verified_at: now,
      payout_msisdn_pending: null,
      payout_msisdn_pending_at: null,
    })
    .eq('id', dist.id)
    .eq('payout_msisdn_pending', ver.msisdn)

  await service
    .from('msisdn_verifications')
    .update({ used_at: now })
    .eq('id', ver.id)

  await service.from('audit_log').insert({
    actor_id: user.id,
    action: 'distributor.msisdn_self_verified',
    resource_type: 'distributors',
    resource_id: String(dist.id),
    before_data: { payout_msisdn: dist.payout_msisdn },
    after_data: { payout_msisdn: ver.msisdn, verified_at: now },
  })

  revalidatePath('/account/distributor/settings')
  revalidatePath('/account/distributor')
  redirect('/account/distributor/settings?verified=1')
}
