/**
 * Local IntaSend webhook route integration tests.
 *
 * These tests intentionally make no network calls to IntaSend, Supabase, or
 * Upstash. They exercise the real POST route, real challenge verification,
 * real event-kind detection, and real Zod payload handling against a small
 * in-memory service adapter. The payment-success boundary is mocked because
 * its database side effects are covered by the production-schema integration
 * suite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const CHALLENGE = 'local-integration-challenge-32-chars'

const state = vi.hoisted(() => ({
  deliveries: new Set<string>(),
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; values: Record<string, unknown>; match: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
  payments: new Map<string, { order_id: number | null }>(),
  orders: new Map<number, { kind: string }>(),
}))

const applyPaymentSuccessMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ INTASEND_WEBHOOK_CHALLENGE: CHALLENGE }),
}))

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: async () => ({ ok: true, limit: 600, remaining: 600, resetMs: 0 }),
}))

vi.mock('@/lib/payments/apply-payment-success', () => ({
  applyPaymentSuccess: (...args: unknown[]) => applyPaymentSuccessMock(...args),
}))

vi.mock('@/lib/supabase/service', () => {
  const service = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args })
      if (name === 'record_webhook_delivery') {
        const key = `${String(args.p_provider)}:${String(args.p_event_id)}`
        const isNew = !state.deliveries.has(key)
        if (isNew) state.deliveries.add(key)
        return { data: isNew, error: null }
      }
      return { data: null, error: null }
    }),
    from: (table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, value: unknown) => ({
          maybeSingle: async () => {
            if (table === 'payments') {
              return { data: state.payments.get(String(value)) ?? null, error: null }
            }
            if (table === 'orders') {
              return { data: state.orders.get(Number(value)) ?? null, error: null }
            }
            return { data: null, error: null }
          },
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          state.updates.push({ table, values, match: { [column]: value } })
          return { error: null }
        },
      }),
      insert: async (values: Record<string, unknown>) => {
        state.inserts.push({ table, values })
        return { error: null }
      },
    }),
  }

  return { createServiceClient: () => service }
})

import { POST } from '@/app/api/intasend/webhook/route'

function webhookRequest(body: unknown): Request {
  return new Request('https://app.example.test/api/intasend/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  state.deliveries.clear()
  state.rpcCalls.length = 0
  state.updates.length = 0
  state.inserts.length = 0
  state.payments.clear()
  state.orders.clear()
  applyPaymentSuccessMock.mockReset()
  applyPaymentSuccessMock.mockResolvedValue({ paid: true, warnings: [], error: null })
})

describe('POST /api/intasend/webhook — local integration', () => {
  it('rejects an invalid challenge before payment processing', async () => {
    const response = await POST(
      webhookRequest({ invoice_id: 'INV-BAD-SIGNATURE', state: 'COMPLETE', challenge: 'wrong' }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'verification failed' })
    expect(applyPaymentSuccessMock).not.toHaveBeenCalled()
    expect(state.rpcCalls).toContainEqual(
      expect.objectContaining({
        name: 'record_webhook_delivery',
        args: expect.objectContaining({ p_signature_ok: false }),
      }),
    )
  })

  it('rejects malformed JSON at the HTTP boundary', async () => {
    const response = await POST(
      new Request('https://app.example.test/api/intasend/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid-json',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'invalid JSON' })
  })

  it('accepts a verified non-terminal collection event without marking an order paid', async () => {
    const response = await POST(
      webhookRequest({ invoice_id: 'INV-PENDING', state: 'PROCESSING', challenge: CHALLENGE }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      kind: 'collection',
      isNew: true,
      applied: false,
    })
    expect(applyPaymentSuccessMock).not.toHaveBeenCalled()
  })

  it('processes a verified COMPLETE collection event exactly once', async () => {
    state.payments.set('INV-COMPLETE', { order_id: 42 })
    state.orders.set(42, { kind: 'retail' })
    const payload = {
      invoice_id: 'INV-COMPLETE',
      state: 'COMPLETE',
      provider: 'M-PESA',
      mpesa_reference: 'MPESA-RECEIPT-001',
      api_ref: 'LL-2026-000042',
      challenge: CHALLENGE,
    }

    const first = await POST(webhookRequest(payload))
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      ok: true,
      kind: 'collection',
      isNew: true,
      applied: true,
    })
    expect(applyPaymentSuccessMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderId: 42,
        provider: 'intasend',
        invoiceId: 'INV-COMPLETE',
        receipt: 'MPESA-RECEIPT-001',
        source: 'webhook',
      }),
    )

    const replay = await POST(webhookRequest(payload))
    expect(replay.status).toBe(200)
    await expect(replay.json()).resolves.toMatchObject({
      ok: true,
      kind: 'collection',
      isNew: false,
      applied: false,
    })
    expect(applyPaymentSuccessMock).toHaveBeenCalledTimes(1)
  })

  it('records a verified schema-invalid event as a non-retriable warning', async () => {
    const response = await POST(
      webhookRequest({ invoice_id: 'INV-SCHEMA', state: null, challenge: CHALLENGE }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ ok: true, kind: 'collection', isNew: true, applied: false })
    expect(body.warnings.join(' ')).toContain('schema validation')
    expect(applyPaymentSuccessMock).not.toHaveBeenCalled()
  })

  it('rejects a send-money event without a challenge, protecting payout updates', async () => {
    const response = await POST(
      webhookRequest({
        tracking_id: 'PAYOUT-UNVERIFIED',
        status: 'Completed',
        transactions: [{ status: 'Successful' }],
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'verification failed' })
  })
})
