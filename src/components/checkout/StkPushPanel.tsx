'use client'

/**
 * StkPushPanel — UX surface for PayHero STK push.
 *
 * The init route (whichever called us) has already created an order and
 * fired the STK push. The user's phone is showing the M-Pesa PIN prompt.
 * This component polls /api/payhero/status until the order flips to
 * `paid`, then redirects to /checkout/return.
 *
 * Source of truth is the server-side webhook chain. This panel only
 * READS order state — it never tries to confirm payment from the
 * frontend.
 */

import { useEffect, useRef, useState } from 'react'

type Status = 'awaiting_prompt' | 'paid' | 'failed' | 'timeout'

const POLL_INTERVAL_MS = 2_500
const TIMEOUT_MS = 75_000 // 75s; PayHero STK push expires at 60s, give buffer

interface Props {
  orderNumber: string
  /** Where to send the user once the order flips to paid. */
  successRedirectUrl: string
  /** Called when the user clicks "Try again" — re-runs the init flow. */
  onRetry: () => void | Promise<void>
  /** Optional copy override. */
  amountLabel?: string
}

export function StkPushPanel({
  orderNumber,
  successRedirectUrl,
  onRetry,
  amountLabel,
}: Props) {
  const [status, setStatus] = useState<Status>('awaiting_prompt')
  const [error, setError] = useState<string | null>(null)
  const elapsedRef = useRef(0)
  const stoppedRef = useRef(false)

  useEffect(() => {
    stoppedRef.current = false
    elapsedRef.current = 0

    const tick = async () => {
      if (stoppedRef.current) return
      try {
        const res = await fetch(
          `/api/payhero/status?ref=${encodeURIComponent(orderNumber)}`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          // 404 is possible briefly during the very first second; ignore
          // and let the next tick try again.
        } else {
          const json = (await res.json()) as { status: string }
          if (json.status === 'paid' || json.status === 'fulfilled' || json.status === 'shipped' || json.status === 'delivered') {
            stoppedRef.current = true
            setStatus('paid')
            window.location.assign(successRedirectUrl)
            return
          }
          if (json.status === 'cancelled' || json.status === 'refunded') {
            stoppedRef.current = true
            setStatus('failed')
            return
          }
        }
      } catch (e) {
        setError((e as Error).message)
      }

      elapsedRef.current += POLL_INTERVAL_MS
      if (elapsedRef.current >= TIMEOUT_MS) {
        stoppedRef.current = true
        setStatus('timeout')
        return
      }
      setTimeout(tick, POLL_INTERVAL_MS)
    }

    const id = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      stoppedRef.current = true
      clearTimeout(id)
    }
  }, [orderNumber, successRedirectUrl])

  return (
    <div className="rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-8 text-center backdrop-blur-sm md:p-10">
      {status === 'awaiting_prompt' ? (
        <>
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[hsl(var(--primary))]/30" />
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--primary))]">
            Check your phone
          </p>
          <h2 className="mt-3 font-serif text-3xl italic tracking-tight md:text-4xl">
            Awaiting your M-Pesa PIN
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
            We sent an M-Pesa prompt to your phone{amountLabel ? ` for ${amountLabel}` : ''}.
            Enter your PIN to complete payment. This page will refresh
            automatically once we confirm.
          </p>
          <p className="mt-6 font-mono text-xs text-[hsl(var(--muted-foreground))]">
            Order {orderNumber}
          </p>
        </>
      ) : null}

      {status === 'paid' ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-emerald-400">
            Confirmed
          </p>
          <h2 className="mt-3 font-serif text-3xl italic tracking-tight md:text-4xl">
            Payment received
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
            Redirecting you now…
          </p>
        </>
      ) : null}

      {status === 'failed' ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-rose-400">
            Cancelled
          </p>
          <h2 className="mt-3 font-serif text-3xl italic tracking-tight md:text-4xl">
            Payment was cancelled
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
            No money was taken from your M-Pesa. You can try again.
          </p>
          <button
            onClick={() => void onRetry()}
            className="mt-8 inline-flex items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
          >
            Try again
          </button>
        </>
      ) : null}

      {status === 'timeout' ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-amber-400">
            Timed out
          </p>
          <h2 className="mt-3 font-serif text-3xl italic tracking-tight md:text-4xl">
            We didn't hear back
          </h2>
          <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
            The M-Pesa prompt may have expired. If you completed payment,
            it may still settle — check your orders in a minute. Otherwise
            try again.
          </p>
          <button
            onClick={() => void onRetry()}
            className="mt-8 inline-flex items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
          >
            Try again
          </button>
        </>
      ) : null}

      {error ? (
        <p className="mt-4 text-xs text-rose-300">{error}</p>
      ) : null}
    </div>
  )
}
