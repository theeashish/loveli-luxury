'use client'

/**
 * /track — landing form. Type an order number, get redirected to
 * /track/<order_number>. The actual tracking happens on the dynamic
 * route; this page is just a friendly entry point.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TrackLanding() {
  const router = useRouter()
  const [value, setValue] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    router.push(`/track/${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-6 py-20 md:py-28">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
        Order tracking
      </p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
        Where's my order?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        Enter your order number. It looks like{' '}
        <span className="font-mono text-[hsl(var(--foreground))]">
          LL-2026-000123
        </span>{' '}
        and is in the confirmation we sent on M-Pesa. No login needed.
      </p>

      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          autoFocus
          autoComplete="off"
          placeholder="LL-2026-000123"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          className="flex-1 rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))]/60 px-4 py-3 text-sm tracking-wider outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-md bg-[hsl(var(--foreground))] px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:opacity-40"
        >
          Track
        </button>
      </form>

      <p className="mt-10 text-xs text-[hsl(var(--muted-foreground))]">
        If you've lost your order number, message our{' '}
        <span className="text-[hsl(var(--foreground))]">Concierge</span> via the
        WhatsApp button. We can look it up by phone or email.
      </p>
    </div>
  )
}
