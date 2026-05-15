'use server'

/**
 * Customer profile self-service.
 *
 * Editable today:
 *   - full_name
 *   - phone (E.164)
 *   - preferred_language, preferred_currency
 *   - marketing_consent (sets marketing_consent_at when true; clears
 *     it when false, with an audit trail)
 *
 * NOT editable here:
 *   - email (auth-bound; needs Supabase auth flow for re-verification)
 *   - national_id, date_of_birth (KYC fields, distributor-only and
 *     locked once provisioned; admin can override via dashboard)
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const phoneSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, 'Phone must be E.164 format e.g. +254712345678')

const inputSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: phoneSchema.optional().or(z.literal('')),
  preferredLanguage: z.string().min(2).max(8).optional().or(z.literal('')),
  preferredCurrency: z.string().length(3).optional().or(z.literal('')),
  marketingConsent: z.enum(['true', 'false']).optional(),
})

export async function updateProfile(formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const parsed = inputSchema.safeParse({
    fullName: formData.get('fullName'),
    phone: formData.get('phone') ?? '',
    preferredLanguage: formData.get('preferredLanguage') ?? '',
    preferredCurrency: formData.get('preferredCurrency') ?? '',
    marketingConsent: formData.get('marketingConsent') ?? 'false',
  })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input')
  }
  const { fullName, phone, preferredLanguage, preferredCurrency, marketingConsent } =
    parsed.data

  const service = createServiceClient()

  // Read current row for audit before/after
  const before = await service
    .from('profiles')
    .select(
      'full_name, phone, preferred_language, preferred_currency, marketing_consent_at',
    )
    .eq('id', user.id)
    .maybeSingle()
  if (before.error || !before.data) throw new Error('Profile not found')
  const beforeRow = before.data as {
    full_name: string
    phone: string | null
    preferred_language: string
    preferred_currency: string
    marketing_consent_at: string | null
  }

  const wantsMarketing = marketingConsent === 'true'
  const consentChange =
    (beforeRow.marketing_consent_at !== null) !== wantsMarketing

  const update: {
    full_name: string
    phone: string | null
    preferred_language?: string
    preferred_currency?: string
    marketing_consent_at?: string | null
  } = {
    full_name: fullName,
    phone: phone || null,
  }
  if (preferredLanguage) update.preferred_language = preferredLanguage
  if (preferredCurrency) update.preferred_currency = preferredCurrency.toUpperCase()

  if (consentChange) {
    update.marketing_consent_at = wantsMarketing
      ? new Date().toISOString()
      : null
  }

  const upd = await service.from('profiles').update(update).eq('id', user.id)
  if (upd.error) throw new Error(`Could not save profile: ${upd.error.message}`)

  await service.from('audit_log').insert({
    actor_id: user.id,
    action: 'profile.updated',
    resource_type: 'profiles',
    resource_id: user.id,
    before_data: JSON.parse(JSON.stringify(beforeRow)),
    after_data: JSON.parse(JSON.stringify(update)),
  })

  revalidatePath('/account/profile')
}

// ---------------------------------------------------------------------------
// requestEmailChange — uses Supabase auth's built-in re-verification.
// ---------------------------------------------------------------------------
//
// Calls supabase.auth.updateUser({ email }) on the user's session. Supabase
// sends a confirmation email to the new address; the email contains a link
// back to the app that completes the change. The `profiles.email` column
// is mirrored from auth.users.email by an existing trigger (or backfilled
// at next login), so we don't touch profiles directly here — that
// would race the auth confirmation.
//
// On success we redirect to a page that tells the user to check their
// inbox. On failure (rate limit, invalid email, same address) we throw a
// message the form can surface.

const emailSchema = z.object({
  newEmail: z.string().email('Enter a valid email address'),
})

export async function requestEmailChange(formData: FormData): Promise<void> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in required')

  const parsed = emailSchema.safeParse({ newEmail: formData.get('newEmail') })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid email')
  }
  const { newEmail } = parsed.data

  if (newEmail.toLowerCase() === (user.email ?? '').toLowerCase()) {
    throw new Error('That is already your email.')
  }

  const { error } = await supabase.auth.updateUser({ email: newEmail })
  if (error) {
    throw new Error(`Could not request email change: ${error.message}`)
  }

  const service = createServiceClient()
  await service.from('audit_log').insert({
    actor_id: user.id,
    action: 'profile.email_change_requested',
    resource_type: 'profiles',
    resource_id: user.id,
    before_data: { email: user.email ?? null },
    after_data: { pending_email: newEmail },
  })

  revalidatePath('/account/profile')
}
