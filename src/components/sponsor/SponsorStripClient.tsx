'use client'

/**
 * Interactive part of SponsorStrip — handles the "Change" expand/collapse
 * and form submission via setSponsorAction.
 */

import { useState, useTransition } from 'react'
import { setSponsorAction } from '@/lib/distributors/set-sponsor-action'

export function SponsorStripClient({ currentCode }: { currentCode: string }) {
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData()
    formData.set('code', code)
    startTransition(async () => {
      const res = await setSponsorAction(formData)
      if (!res.ok) {
        setError(res.error ?? 'Could not change sponsor.')
        return
      }
      // Reload so middleware + page re-read the cookie consistently.
      window.location.reload()
    })
  }

  if (editing) {
    return (
      <div className="border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 px-4 py-3 md:px-6">
        <form
          onSubmit={onSubmit}
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-xs"
        >
          <span className="text-[hsl(var(--muted-foreground))]">
            Change sponsor:
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="LL-XX-XXXX"
            className="w-32 rounded border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))] px-2 py-1 font-mono text-xs uppercase outline-none transition focus:border-[hsl(var(--primary))]"
            maxLength={11}
            autoFocus
          />
          <button
            type="submit"
            disabled={pending || code.length === 0}
            className="rounded bg-[hsl(var(--foreground))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setError(null)
              setCode('')
            }}
            className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] underline-offset-4 transition hover:text-[hsl(var(--primary))] hover:underline"
          >
            Cancel
          </button>
          {error ? (
            <span className="text-[11px] text-rose-300">{error}</span>
          ) : null}
        </form>
      </div>
    )
  }

  return (
    <div className="border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/40 px-4 py-2.5 text-xs md:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <span className="text-[hsl(var(--muted-foreground))]">
          Your sponsor:
        </span>
        <code className="font-mono text-[hsl(var(--primary))]">
          {currentCode}
        </code>
        <span className="text-[hsl(var(--muted-foreground))]">·</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] underline-offset-4 transition hover:text-[hsl(var(--primary))] hover:underline"
        >
          Change →
        </button>
      </div>
    </div>
  )
}
