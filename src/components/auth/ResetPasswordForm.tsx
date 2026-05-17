'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    // Hard-nav so the freshly updated session is observed by middleware.
    setTimeout(() => {
      window.location.assign('/post-login')
    }, 1200)
  }

  if (done) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
        <p className="font-medium">Password updated.</p>
        <p className="mt-2 text-emerald-200/80">Signing you in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--foreground))]"
        >
          New password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))]/60 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
        />
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--foreground))]"
        >
          Confirm new password
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  )
}
