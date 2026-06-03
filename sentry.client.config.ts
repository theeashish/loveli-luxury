import * as Sentry from '@sentry/nextjs'

// Inert unless NEXT_PUBLIC_SENTRY_DSN is set.
//
// Client SDK ships **error reporting only**. Tracing + Replay are dropped at
// *build time* via `bundleSizeOptimizations.excludeTracing/excludeReplay*` in
// `next.config.js`, so the heavy integrations (~180 KiB combined) are not in
// the browser bundle at all. Server + edge configs keep tracing enabled — only
// the browser is slimmed.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
})
