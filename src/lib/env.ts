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

// -----------------------------------------------------------------------------
// Public schema (NEXT_PUBLIC_*, safe in the browser)
// -----------------------------------------------------------------------------
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: z.string().min(10),
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Server schema (server-only, NEVER bundled to client)
// -----------------------------------------------------------------------------
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  FLUTTERWAVE_SECRET_KEY: z.string().min(10),
  FLUTTERWAVE_ENCRYPTION_KEY: z.string().min(10),
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().min(20),
  REVALIDATE_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  ENABLE_DISTRIBUTOR_SIGNUP: z.string().transform((v) => v === 'true').default('false'),
  ENABLE_PAYOUTS: z.string().transform((v) => v === 'true').default('false'),
  ENABLE_MAINTENANCE_MODE: z.string().transform((v) => v === 'true').default('false'),
})

// -----------------------------------------------------------------------------
// Parsed exports
// -----------------------------------------------------------------------------

const publicResult = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
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
    FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
    FLUTTERWAVE_ENCRYPTION_KEY: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
    FLUTTERWAVE_WEBHOOK_SECRET_HASH: process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    ENABLE_DISTRIBUTOR_SIGNUP: process.env.ENABLE_DISTRIBUTOR_SIGNUP,
    ENABLE_PAYOUTS: process.env.ENABLE_PAYOUTS,
    ENABLE_MAINTENANCE_MODE: process.env.ENABLE_MAINTENANCE_MODE,
  })

  if (!result.success) {
    console.error('Invalid server environment:', result.error.flatten().fieldErrors)
    throw new Error('Server environment validation failed. Check .env.local against .env.example.')
  }

  return result.data
}
