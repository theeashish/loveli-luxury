'use client'

/**
 * Account creation form. Talks to Supabase auth.signUp directly.
 *
 * Behaviour:
 *   - Creates the auth user with email + password + full_name in user_metadata.
 *   - If Supabase is configured to confirm emails (project default), the
 *     session won't be returned and we show a "check your inbox" notice.
 *   - If email confirmation is off in Supabase, the user is signed in
 *     immediately and we redirect to `next` (defaults to the homepage).
 *
 * `next` is passed from the server page (already validated) so we don't
 * use useSearchParams here — that hook forces a Suspense bailout and
 * causes a visible flash on first paint.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SignupForm({ next: nextProp }: { next?: string }) {
  const next =
    nextProp && nextProp.startsWith('/') && !nextProp.startsWith('//') ? nextProp : '/'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setBusy(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}${next}`
            : undefined,
      },
    })
    setBusy(false)

    if (err) {
      setError(err.message)
      return
    }

    if (!data.session) {
      setInfo(
        `Check your inbox at ${email} for a confirmation link to finish setting up your account.`,
      )
      return
    }

    window.location.assign(next)
  }

  const inputClass =
    'w-full rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))]/60 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30'
  const labelClass =
    'mb-2 block text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--foreground))]'

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="fullName" className={labelClass}>
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
          At least 8 characters.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {info}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-2 w-full rounded-md bg-[hsl(var(--foreground))] px-6 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Creating account…' : 'Create my account'}
      </button>
    </form>
  )
}
