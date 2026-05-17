'use server'

/**
 * setSponsorAction — Server action invoked by the SponsorStrip's
 * "Change" form. Validates the entered sponsor_code, confirms it
 * matches an active distributor, and updates the ll_sponsor cookie
 * for the current browser.
 *
 * Returning {ok, error} (instead of throwing) so the client can render
 * a friendly inline error without losing the user's input.
 */

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

const SPONSOR_COOKIE = 'll_sponsor'
const SPONSOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const SPONSOR_CODE_RE = /^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/

export async function setSponsorAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const raw = (formData.get('code') as string | null) ?? ''
  const code = raw.trim().toUpperCase()

  if (!SPONSOR_CODE_RE.test(code)) {
    return {
      ok: false,
      error: 'Invalid format. Sponsor codes look like LL-AB-7Q3K.',
    }
  }

  const service = createServiceClient()
  const r = await service
    .from('distributors')
    .select('id, is_active')
    .eq('sponsor_code', code)
    .maybeSingle()

  if (!r.data) {
    return { ok: false, error: 'No sponsor found with that code.' }
  }
  const row = r.data as { id: number; is_active: boolean }
  if (!row.is_active) {
    return { ok: false, error: 'That sponsor is inactive.' }
  }

  cookies().set(SPONSOR_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SPONSOR_COOKIE_MAX_AGE,
  })

  // Re-render the surfaces that show the strip so the new code shows up
  // without a hard reload.
  revalidatePath('/cart')
  revalidatePath('/checkout')

  return { ok: true }
}
