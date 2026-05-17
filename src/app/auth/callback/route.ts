/**
 * /auth/callback — Supabase email-link redirect target.
 *
 * Handles BOTH supported flows:
 *   1. token_hash + type (recommended for SSR; see Supabase docs)
 *      — Used by password-reset and magic-link emails when the email
 *        template embeds {{ .TokenHash }}. Exchanged via verifyOtp(),
 *        which does NOT depend on browser-side PKCE storage.
 *   2. code (PKCE)
 *      — Used when the template embeds {{ .ConfirmationURL }} (the
 *        default older template). Exchanged via exchangeCodeForSession().
 *        Fails if the user clicks the email link in a different browser
 *        than where they submitted the form.
 *
 * IMPORTANT — one-time Supabase config:
 *   1. Dashboard → Authentication → URL Configuration → Redirect URLs
 *      Add: http://localhost:3000/auth/callback
 *           https://loveli-luxury.vercel.app/auth/callback
 *   2. Dashboard → Authentication → Email Templates → "Reset Password"
 *      Replace the link with the token_hash variant (more reliable):
 *      <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Reset password</a>
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/safe-next'

export const dynamic = 'force-dynamic'

const VALID_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const typeRaw = searchParams.get('type')
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next') ?? undefined) || '/'

  const supabase = createClient()

  // Preferred path: token_hash + type (no PKCE dependency).
  if (token_hash && typeRaw && VALID_OTP_TYPES.has(typeRaw as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: typeRaw as EmailOtpType,
    })
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      )
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Fallback: code (PKCE). Works only if the verifier cookie survived
  // the email round-trip (same browser, no storage clearing).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      )
    }
    return NextResponse.redirect(`${origin}${next}`)
  }

  // No usable params — bounce to login with a generic hint.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      'The reset link is invalid or has expired. Please request a new one.',
    )}`,
  )
}
