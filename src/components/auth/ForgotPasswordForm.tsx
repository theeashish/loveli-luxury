'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
        <p className="font-medium">Check your email.</p>
        <p className="mt-2 text-emerald-200/80">
          If an account exists for <span className="font-mono">{email}</span>,
          a password-reset link is on its way. The link expires in 1 hour.
        </p>
      </div>
    )
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
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}
