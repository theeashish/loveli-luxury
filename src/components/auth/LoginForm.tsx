'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const params = useSearchParams()
  // Default to homepage when no `next` is provided. Admin routes set
  // their own `?next=/admin/...` via middleware redirects, so this only
  // affects bare /login visits (e.g. from the public header).
  const next = params.get('next') ?? '/'

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
    // Hard navigation rather than router.push so middleware runs on the
    // request, picks up the freshly-set Supabase auth cookies, and the
    // destination's server component sees the session immediately.
    // router.push() can race the cookie propagation in production builds
    // and bounce an auth-required page back to /login.
    window.location.assign(next)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs uppercase tracking-[0.2em] mb-2">Email</label>
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
        <label className="block text-xs uppercase tracking-[0.2em] mb-2">Password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        />
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
