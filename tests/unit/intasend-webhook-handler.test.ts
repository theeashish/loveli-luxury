/**
 * Tests the webhook processing pipeline added in this pass:
 * challenge verification is mandatory and rejects (not silently accepts)
 * a missing/invalid challenge even for send_money events (see the
 * security note in webhook-handler.ts); a verified duplicate is a no-op;
 * and each event kind routes to the right side effect.
 *
 * The Supabase service client is a hand-rolled fake rather than a mock
 * library stub — the shape needed (`.from(table).select().eq().maybeSingle()`
 * chains + `.rpc()`) is small and explicit fakes make the exact
 * expectations obvious to a future reader.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CHALLENGE = 'the-configured-challenge-value-32chars'

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ INTASEND_WEBHOOK_CHALLENGE: CHALLENGE }),
}))

const applyPaymentSuccessMock = vi.fn()
vi.mock('@/lib/payments/apply-payment-success', () => ({
  applyPaymentSuccess: (...args: unknown[]) => applyPaymentSuccessMock(...args),
}))

import { processIntasendWebhook } from '@/lib/intasend/webhook-handler'
import { WebhookVerificationError } from '@/lib/payments/errors'

type RpcCall = { name: string; args: Record<string, unknown> }

function makeFakeService(opts: {
  recordWebhookDeliveryReturns: boolean
  payments?: Record<string, { order_id: number | null }>
  orders?: Record<number, { kind: string }>
  payouts?: Record<string, { id: number; status: string }>
}) {
  const rpcCalls: RpcCall[] = []
  const updates: Array<{ table: string; match: Record<string, unknown>; values: Record<string, unknown> }> = []
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = []

  const service = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      if (name === 'record_webhook_delivery') {
        return { data: opts.recordWebhookDeliveryReturns, error: null }
      }
      return { data: null, error: null }
    }),
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, val: unknown) => ({
          maybeSingle: async () => {
            if (table === 'payments') {
              const row = opts.payments?.[val as string]
              return { data: row ?? null, error: null }
            }
            if (table === 'orders') {
              const row = opts.orders?.[val as number]
              return { data: row ?? null, error: null }
            }
            if (table === 'payouts' && col === 'tracking_id') {
              const row = opts.payouts?.[val as string]
              return { data: row ?? null, error: null }
            }
            return { data: null, error: null }
          },
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (col: string, val: unknown) => {
          updates.push({ table, match: { [col]: val }, values })
          return { error: null }
        },
      }),
      insert: async (values: Record<string, unknown>) => {
        inserts.push({ table, values })
        return { error: null }
      },
    }),
  }

  return { service, rpcCalls, updates, inserts }
}

beforeEach(() => {
  applyPaymentSuccessMock.mockReset()
})

describe('processIntasendWebhook — challenge enforcement', () => {
  it('rejects a collection event with a missing challenge', async () => {
    const { service } = makeFakeService({ recordWebhookDeliveryReturns: true })
    const body = { invoice_id: 'INV1', state: 'COMPLETE' }
    await expect(processIntasendWebhook(service as never, body)).rejects.toThrow(
      WebhookVerificationError,
    )
  })

  it('rejects a send_money event with a missing challenge (conservative — docs example omits it, we still require it)', async () => {
    const { service } = makeFakeService({ recordWebhookDeliveryReturns: true })
    const body = { tracking_id: 'TRK1', status: 'Completed', transactions: [] }
    await expect(processIntasendWebhook(service as never, body)).rejects.toThrow(
      WebhookVerificationError,
    )
  })

  it('rejects a wrong challenge value', async () => {
    const { service } = makeFakeService({ recordWebhookDeliveryReturns: true })
    const body = { invoice_id: 'INV1', state: 'COMPLETE', challenge: 'wrong-value' }
    await expect(processIntasendWebhook(service as never, body)).rejects.toThrow(
      WebhookVerificationError,
    )
  })

  it('rejects a body matching no known event shape', async () => {
    const { service } = makeFakeService({ recordWebhookDeliveryReturns: true })
    await expect(
      processIntasendWebhook(service as never, { some: 'garbage' }),
    ).rejects.toThrow(WebhookVerificationError)
  })
})

describe('processIntasendWebhook — dedup', () => {
  it('returns isNew:false and does not apply on a verified replay', async () => {
    const { service, rpcCalls } = makeFakeService({ recordWebhookDeliveryReturns: false })
    const body = { invoice_id: 'INV1', state: 'PENDING', challenge: CHALLENGE }
    const result = await processIntasendWebhook(service as never, body)
    expect(result).toEqual({ kind: 'collection', isNew: false, applied: false, warnings: [] })
    // mark_webhook_processed must NOT be called for a duplicate.
    expect(rpcCalls.some((c) => c.name === 'mark_webhook_processed')).toBe(false)
  })
})

describe('processIntasendWebhook — collection routing', () => {
  it('applies a COMPLETE collection event via applyPaymentSuccess when a matching payments row exists', async () => {
    applyPaymentSuccessMock.mockResolvedValue({ paid: true, warnings: [], error: null })
    const { service, rpcCalls } = makeFakeService({
      recordWebhookDeliveryReturns: true,
      payments: { INV1: { order_id: 42 } },
      orders: { 42: { kind: 'retail' } },
    })
    const body = {
      invoice_id: 'INV1',
      state: 'COMPLETE',
      provider: 'M-PESA',
      challenge: CHALLENGE,
    }
    const result = await processIntasendWebhook(service as never, body)
    expect(result.kind).toBe('collection')
    expect(result.isNew).toBe(true)
    expect(result.applied).toBe(true)
    expect(applyPaymentSuccessMock).toHaveBeenCalledTimes(1)
    expect(rpcCalls.some((c) => c.name === 'mark_webhook_processed')).toBe(true)
  })

  it('does not apply a PENDING collection event (nothing to do yet)', async () => {
    const { service } = makeFakeService({
      recordWebhookDeliveryReturns: true,
      payments: { INV1: { order_id: 42 } },
      orders: { 42: { kind: 'retail' } },
    })
    const body = { invoice_id: 'INV1', state: 'PENDING', challenge: CHALLENGE }
    const result = await processIntasendWebhook(service as never, body)
    expect(result.applied).toBe(false)
    expect(applyPaymentSuccessMock).not.toHaveBeenCalled()
  })

  it('warns (not throws) when no payments row exists for the invoice', async () => {
    const { service } = makeFakeService({ recordWebhookDeliveryReturns: true })
    const body = { invoice_id: 'GHOST', state: 'COMPLETE', challenge: CHALLENGE }
    const result = await processIntasendWebhook(service as never, body)
    expect(result.applied).toBe(false)
    expect(result.warnings.some((w) => w.includes('GHOST'))).toBe(true)
  })
})

describe('processIntasendWebhook — send_money routing', () => {
  it('marks a payout completed when its transaction status is Successful', async () => {
    const { service, updates } = makeFakeService({
      recordWebhookDeliveryReturns: true,
      payouts: { TRK1: { id: 7, status: 'processing' } },
    })
    const body = {
      tracking_id: 'TRK1',
      status: 'Completed',
      challenge: CHALLENGE,
      transactions: [
        {
          status: 'Successful',
          provider_reference: 'MPESA-REF',
        },
      ],
    }
    const result = await processIntasendWebhook(service as never, body)
    expect(result.kind).toBe('send_money')
    expect(result.applied).toBe(true)
    const payoutUpdate = updates.find((u) => u.table === 'payouts')
    expect(payoutUpdate?.values.status).toBe('completed')
  })

  it('marks a payout failed when its transaction status is Failed', async () => {
    const { service, updates } = makeFakeService({
      recordWebhookDeliveryReturns: true,
      payouts: { TRK1: { id: 7, status: 'processing' } },
    })
    const body = {
      tracking_id: 'TRK1',
      status: 'Completed',
      challenge: CHALLENGE,
      transactions: [{ status: 'Failed', status_description: 'Insufficient funds' }],
    }
    const result = await processIntasendWebhook(service as never, body)
    expect(result.applied).toBe(true)
    const payoutUpdate = updates.find((u) => u.table === 'payouts')
    expect(payoutUpdate?.values.status).toBe('failed')
    expect(payoutUpdate?.values.failure_reason).toBe('Insufficient funds')
  })
})

describe('processIntasendWebhook — chargeback routing', () => {
  it('records a chargeback status change to audit_log', async () => {
    const { service, inserts } = makeFakeService({ recordWebhookDeliveryReturns: true })
    const body = {
      chargeback_id: 'CB1',
      status: 'PENDING',
      challenge: CHALLENGE,
      invoice: { invoice_id: 'INV1' },
    }
    const result = await processIntasendWebhook(service as never, body)
    expect(result.kind).toBe('chargeback')
    expect(result.applied).toBe(true)
    expect(inserts.some((i) => i.table === 'audit_log')).toBe(true)
  })
})
