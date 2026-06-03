/**
 * Environment variable validation.
 *
 * Imported once at app startup. Throws if any required var is missing or
 * malformed. This prevents the class of bug where a misconfigured deploy
 * runs but breaks at the first DB call.
 *
 * Server-only secrets are accessed through `serverEnv`. Client-safe values
 * (NEXT_PUBLIC_*) through `publicEnv`. The split prevents accidentally
 * leaking a server secret to the browser bundle.
 */

import { z } from 'zod'

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

// -----------------------------------------------------------------------------
// Public schema (NEXT_PUBLIC_*, safe in the browser)
// -----------------------------------------------------------------------------
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: z.string().optional(),
  // Phase 4a — WhatsApp Concierge floating button. E.164 format
  // (+254...). When unset the button renders nothing (safe degrade).
  // Editable post-deploy via Vercel env vars; no code change needed.
  // Trim whitespace before validating — Vercel env values can pick up
  // trailing newlines depending on how they were set (e.g. piping with
  // `echo` instead of `printf`).
  NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v
      const trimmed = v.trim()
      return trimmed === '' ? undefined : trimmed
    },
    z.string().regex(/^\+\d{8,15}$/, 'E.164 phone format').optional(),
  ),
  // Client-side Sentry DSN (public). Error tracking is a no-op unless set.
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(emptyToUndef, z.string().optional()),
})

// -----------------------------------------------------------------------------
// Server schema (server-only, NEVER bundled to client)
// -----------------------------------------------------------------------------
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  REVALIDATE_SECRET: z.string().min(32),
  // Bearer secret for /api/cron/monthly-close. Required only at the call
  // site; the route reads it lazily so a missing value doesn't break boot.
  CRON_SECRET: z.preprocess(emptyToUndef, z.string().min(32).optional()),
  // Optional fields. Treat empty string as "unset" so a blank line in
  // .env.local doesn't trip the format validators (URL/email/min-length).
  SENTRY_DSN: z.preprocess(emptyToUndef, z.string().url().optional()),
  SENTRY_AUTH_TOKEN: z.preprocess(emptyToUndef, z.string().optional()),
  RESEND_API_KEY: z.preprocess(emptyToUndef, z.string().min(10).optional()),
  RESEND_FROM_EMAIL: z.preprocess(emptyToUndef, z.string().email().optional()),
  // Africa's Talking SMS gateway (KE-first). If unset, MSISDN verification
  // codes are written to audit_log instead of sent — admin manually
  // relays. This makes the verification flow run end-to-end without
  // requiring an SMS provider at the time of build.
  AFRICAS_TALKING_USERNAME: z.preprocess(emptyToUndef, z.string().optional()),
  AFRICAS_TALKING_API_KEY: z.preprocess(emptyToUndef, z.string().min(10).optional()),
  AFRICAS_TALKING_SENDER_ID: z.preprocess(emptyToUndef, z.string().optional()),
  ENABLE_DISTRIBUTOR_SIGNUP: z.string().transform((v) => v === 'true').default('false'),
  ENABLE_PAYOUTS: z.string().transform((v) => v === 'true').default('false'),
  ENABLE_MAINTENANCE_MODE: z.string().transform((v) => v === 'true').default('false'),
  // IntaSend (Kenya M-Pesa STK + B2C + card + bank). All server-only.
  // Phase 1+ of the PayHero → IntaSend migration. Validated lazily inside
  // src/lib/intasend/client.ts at call time; the collect/payout endpoints
  // throw cleanly when the required values are missing.
  //
  // INTASEND_PUBLISHABLE_KEY: pk_test_... / pk_live_... — the *publishable*
  //   key. Despite its name, this is server-only in our setup; it is only
  //   exposed to the browser if/when we ship the IntaSend inline checkout
  //   widget (and even then only via a tightly-scoped page-level prop).
  // INTASEND_SECRET_TOKEN: ISSecretKey_... — the API secret. Never client.
  // INTASEND_WALLET_ID: the IntaSend wallet that collections land in and
  //   that payouts draw from. Acts as the platform's float account.
  // INTASEND_WEBHOOK_CHALLENGE: the shared secret IntaSend signs webhook
  //   bodies with. Verification is MANDATORY on every webhook (see
  //   src/lib/intasend/signature.ts in Phase 1). A missing or wrong
  //   challenge means the webhook handler rejects the call.
  // INTASEND_TEST: 'true' → sandbox, anything else → production. Defaults
  //   to production-treat so a missing value never silently downgrades a
  //   live deploy to sandbox.
  INTASEND_PUBLISHABLE_KEY: z.preprocess(emptyToUndef, z.string().optional()),
  INTASEND_SECRET_TOKEN:    z.preprocess(emptyToUndef, z.string().optional()),
  INTASEND_WALLET_ID:       z.preprocess(emptyToUndef, z.string().optional()),
  INTASEND_WEBHOOK_CHALLENGE: z.preprocess(emptyToUndef, z.string().min(20).optional()),
  INTASEND_TEST: z
    .preprocess(emptyToUndef, z.string().optional())
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  // Configurable ceiling above which payouts require a superadmin
  // approval action before they fire. Stored as KES whole-shilling
  // integer; the payout endpoint converts to minor units. Defaults to
  // 100,000 KES if unset.
  INTASEND_PAYOUT_APPROVAL_CEILING_KES: z
    .preprocess(emptyToUndef, z.string().optional())
    .transform((v) => (v === undefined ? 100_000 : Number.parseInt(v, 10))),
  // Upstash Redis for rate limiting. Unset → limiter is a no-op (fail-open).
  UPSTASH_REDIS_REST_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyToUndef, z.string().min(10).optional()),
  // Admin 2FA enforcement. 'true' → admins with an enrolled TOTP factor must
  // pass an aal2 challenge to use /admin. Default off (inert).
  ENFORCE_ADMIN_MFA: z.string().transform((v) => v === 'true').default('false'),
})

// -----------------------------------------------------------------------------
// Parsed exports
// -----------------------------------------------------------------------------

const publicResult = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER:
    process.env.NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
})

if (!publicResult.success) {
  console.error('Invalid public environment:', publicResult.error.flatten().fieldErrors)
  throw new Error('Public environment validation failed. Check .env.local against .env.example.')
}

export const publicEnv = publicResult.data

/**
 * Server-only env. Accessing this from a client component will throw at build
 * time because process.env server vars are stripped from the client bundle.
 */
export function getServerEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() cannot be called from the browser')
  }

  const result = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    AFRICAS_TALKING_USERNAME: process.env.AFRICAS_TALKING_USERNAME,
    AFRICAS_TALKING_API_KEY: process.env.AFRICAS_TALKING_API_KEY,
    AFRICAS_TALKING_SENDER_ID: process.env.AFRICAS_TALKING_SENDER_ID,
    ENABLE_DISTRIBUTOR_SIGNUP: process.env.ENABLE_DISTRIBUTOR_SIGNUP,
    ENABLE_PAYOUTS: process.env.ENABLE_PAYOUTS,
    ENABLE_MAINTENANCE_MODE: process.env.ENABLE_MAINTENANCE_MODE,
    INTASEND_PUBLISHABLE_KEY: process.env.INTASEND_PUBLISHABLE_KEY,
    INTASEND_SECRET_TOKEN: process.env.INTASEND_SECRET_TOKEN,
    INTASEND_WALLET_ID: process.env.INTASEND_WALLET_ID,
    INTASEND_WEBHOOK_CHALLENGE: process.env.INTASEND_WEBHOOK_CHALLENGE,
    INTASEND_TEST: process.env.INTASEND_TEST,
    INTASEND_PAYOUT_APPROVAL_CEILING_KES:
      process.env.INTASEND_PAYOUT_APPROVAL_CEILING_KES,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    ENFORCE_ADMIN_MFA: process.env.ENFORCE_ADMIN_MFA,
  })

  if (!result.success) {
    console.error('Invalid server environment:', result.error.flatten().fieldErrors)
    throw new Error('Server environment validation failed. Check .env.local against .env.example.')
  }

  return result.data
}
