'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Factor = { id: string; friendly_name: string | null; status: string }

export default function SecurityPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [factors, setFactors] = useState<Factor[]>([])
  const [enrol, setEnrol] = useState<{ factorId: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors((data?.totp ?? []) as Factor[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const verified = factors.filter((f) => f.status === 'verified')

  async function startEnrol() {
    setErr(null)
    setMsg(null)
    setBusy(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    setBusy(false)
    if (error || !data) {
      setErr(error?.message ?? 'Enrolment failed. Is MFA enabled on the Supabase project?')
      return
    }
    setEnrol({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verifyCode() {
    setErr(null)
    setMsg(null)
    const factorId = enrol?.factorId ?? verified[0]?.id
    if (!factorId) return
    setBusy(true)
    try {
      const ch = await supabase.auth.mfa.challenge({ factorId })
      if (ch.error || !ch.data) throw new Error(ch.error?.message ?? 'Challenge failed')
      const v = await supabase.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: code.trim() })
      if (v.error) throw new Error(v.error.message)
      setMsg('Verified. Two-factor authentication is active on your account.')
      setEnrol(null)
      setCode('')
      await refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function unenroll(factorId: string) {
    setErr(null)
    setMsg(null)
    setBusy(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (error) {
      setErr(error.message)
      return
    }
    await refresh()
  }

  const inputCls =
    'w-40 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-center font-mono tracking-[0.3em]'
  const btnCls =
    'rounded-full bg-[hsl(var(--foreground))] px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--background))] transition hover:scale-[1.02] disabled:opacity-50'

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-eyebrow">Account</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">Two-factor authentication</h1>
      <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        Add an authenticator app (Google Authenticator, Authy, 1Password) for an extra layer of
        security. Recommended for admin accounts.
      </p>

      {msg ? (
        <p className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mt-6 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {err}
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-6">
        {loading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
        ) : verified.length > 0 && !enrol ? (
          <div className="space-y-4">
            <p className="text-sm">Authenticator app is active.</p>
            <ul className="space-y-2">
              {verified.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-4 py-3 text-sm"
                >
                  <span>{f.friendly_name ?? 'Authenticator app'}</span>
                  <button
                    onClick={() => unenroll(f.id)}
                    disabled={busy}
                    className="text-xs uppercase tracking-[0.2em] text-rose-400 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 pt-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
                className={inputCls}
              />
              <button onClick={verifyCode} disabled={busy || code.length < 6} className={btnCls}>
                Verify code
              </button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Enter a current 6-digit code to confirm a step-up challenge.
            </p>
          </div>
        ) : enrol ? (
          <div className="space-y-4">
            <p className="text-sm">Scan this with your authenticator app, then enter the 6-digit code.</p>
            <div
              className="inline-block rounded-md bg-white p-3"
              // Supabase returns the QR as an inline SVG string.
              dangerouslySetInnerHTML={{ __html: enrol.qr }}
            />
            <p className="break-all text-xs text-[hsl(var(--muted-foreground))]">
              Or enter this secret manually: <code className="text-[hsl(var(--primary))]">{enrol.secret}</code>
            </p>
            <div className="flex items-center gap-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
                className={inputCls}
              />
              <button onClick={verifyCode} disabled={busy || code.length < 6} className={btnCls}>
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No authenticator app is set up yet.
            </p>
            <button onClick={startEnrol} disabled={busy} className={btnCls}>
              Set up authenticator app
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
