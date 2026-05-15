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
 * The profiles row is created either by a Supabase trigger on auth.users
 * (recommended) or lazily on first authenticated request. We don't insert
 * directly here — that requires the service role.
 */

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignupForm() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/'

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

    // If email confirmation is enabled in the Supabase project, `session`
    // will be null and the user needs to click a link in their inbox.
    if (!data.session) {
      setInfo(
        `Check your inbox at ${email} for a confirmation link to finish setting up your account.`,
      )
      return
    }

    // Hard navigation so middleware runs and the server-rendered next
    // page sees the freshly-set session cookies. See LoginForm for the
    // long explanation; same race condition applies on signup.
    window.location.assign(next)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.2em]">
          Full name
        </label>
        <input
          type="text"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.2em]">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.2em]">
          Password
        </label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          At least 8 characters.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-xs uppercase tracking-[0.2em]">
          Confirm password
        </label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {info ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          {info}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {busy ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
