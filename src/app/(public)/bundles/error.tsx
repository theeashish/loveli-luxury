'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

/**
 * Error boundary for /bundles and /bundles/[slug].
 *
 * listBundles() and getBundleBySlug() (src/lib/catalog/queries.ts) both
 * throw on any database failure rather than returning a fallback — same
 * reasoning as /shop's boundary: there's no safe placeholder for "what
 * bundles exist." Placed at this segment level so it also covers the
 * nested [slug] detail route, since both throw the same way for the same
 * reason. Reports to Sentry so a real production DB outage is visible,
 * not just a silent 500 in server logs.
 */
export default function BundlesError({
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
      <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Bundles</p>
      <h1 className="mt-3 text-3xl font-light tracking-tight">Momentarily unavailable</h1>
      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        We&rsquo;re having trouble loading bundles right now. This is on our end — please try
        again in a moment.
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
