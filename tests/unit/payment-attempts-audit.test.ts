/**
 * Regression test for the payment_attempts audit-trail insert.
 *
 * Background: from migration 019 the live table was missing three columns
 * (attempt_type, http_status, error_message) because an earlier hand-applied
 * DDL had already created the table and 019's CREATE TABLE IF NOT EXISTS was
 * a no-op. Every dispatcher insert then returned a PostgREST "column does not
 * exist" error in the resolved `{ error }` object — but the dispatcher only
 * awaited the insert without inspecting `error`, so the failure was silent
 * and the audit table stayed empty after ~15 STK pushes.
 *
 * Migration 030 fixes the schema. This test locks in the *other* half of the
 * fix: the dispatcher must surface insert errors via console.warn so any
 * future drift can't recur silently.
 *
 * Env vars are set in vi.hoisted so env.ts validation passes at import.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL ||= 'https://example.com'
  process.env.NEXT_PUBLIC_APP_NAME ||= 'Loveli'
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'a'.repeat(40)
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'a'.repeat(40)
  process.env.REVALIDATE_SECRET ||= 'a'.repeat(40)
  process.env.PAYHERO_AUTH_TOKEN ||= 'pre-encoded-basic-token-xxxxxxxxxxxx'
  process.env.PAYHERO_WEBHOOK_TOKEN ||= 'test-webhook-token-min-20-chars-long'
  process.env.PAYHERO_CHANNEL_ID_STK ||= '8233'
})

import { logAttempt } from '../../src/lib/payments/dispatcher'

// Build a minimal service stub that satisfies the `service.from(...).insert(...)`
// call chain the dispatcher exercises. The dispatcher casts the table builder
// to `{ insert: (row) => Promise<{ error }> }` so we just need that shape.
function makeService(insertResult: { error: { message: string } | null } | (() => Promise<never>)) {
  return {
    from: () => ({
      insert:
        typeof insertResult === 'function'
          ? insertResult
          : async () => insertResult,
    }),
  } as unknown as Parameters<typeof logAttempt>[0]
}

const ROW = {
  order_id: 1,
  provider: 'payhero',
  attempt_type: 'stk_push',
  request_payload: { ok: true },
  response_payload: { ok: true },
  status: 'initiated',
} as const

describe('logAttempt — payment_attempts audit insert', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('stays quiet when the insert succeeds (error: null)', async () => {
    await logAttempt(makeService({ error: null }), { ...ROW })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('logs the PostgREST error when supabase returns { error } (the silent-drift bug)', async () => {
    const message =
      'column "attempt_type" of relation "payment_attempts" does not exist'
    await logAttempt(makeService({ error: { message } }), { ...ROW })

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const [label, body] = warnSpy.mock.calls[0] ?? []
    expect(label).toContain('payment_attempts insert failed')
    expect(body).toBe(message)
  })

  it('logs when the insert throws (network failure)', async () => {
    await logAttempt(
      makeService(async () => {
        throw new Error('socket hang up')
      }),
      { ...ROW },
    )

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const [label, body] = warnSpy.mock.calls[0] ?? []
    expect(label).toContain('payment_attempts insert skipped')
    expect(body).toBe('socket hang up')
  })

  it('does not throw even when the underlying insert rejects', async () => {
    await expect(
      logAttempt(
        makeService(async () => {
          throw new Error('boom')
        }),
        { ...ROW },
      ),
    ).resolves.toBeUndefined()
  })
})
