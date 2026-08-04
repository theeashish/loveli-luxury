'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

/**
 * Error boundary for /shop.
 *
 * listProductSummaries() (src/lib/catalog/queries.ts) deliberately throws
 * on any database failure rather than returning a fallback — there's no
 * safe placeholder for "what products exist." Without this boundary, that
 * throw crashed straight to Next.js's generic error page. This gives
 * visitors an on-brand message and a retry, and reports the failure to
 * Sentry so a real production DB outage actually gets noticed instead of
 * only showing up as a silent 500 in server logs.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Shop</p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">Momentarily unavailable</h1>
      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        We&rsquo;re having trouble loading the collection right now. This is on our end — please
        try again in a moment.
      </p>
      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          onClick={() => reset()}
          className="rounded-[var(--radius)] border border-[hsl(var(--border))] px-5 py-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--foreground))] transition hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--primary))]"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
