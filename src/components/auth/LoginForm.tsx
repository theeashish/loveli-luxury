'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({ next: nextProp }: { next?: string }) {
  // When the caller provided an explicit safe `next`, honour it
  // verbatim. Otherwise hand off to /post-login which routes by role
  // (admin → /admin, distributor → /account/partner, else → /account).
  const hasExplicitNext =
    !!nextProp && nextProp.startsWith('/') && !nextProp.startsWith('//')
  const next = hasExplicitNext ? nextProp : '/post-login'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }
    // Hard navigation so middleware runs on the request and the
    // destination's server component sees the freshly-set session cookies.
    window.location.assign(next)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--foreground))]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))]/60 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--foreground))]"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))]/60 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
        />
      </div>
      {error ? (
        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-2 w-full rounded-md bg-[hsl(var(--foreground))] px-6 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
