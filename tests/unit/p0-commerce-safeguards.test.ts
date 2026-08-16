import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/email/receipt', () => ({
  sendOrderReceipt: vi.fn().mockResolvedValue(undefined),
}))

import { bundleCheckoutGoneResponse, hasBundleCheckoutLine } from '@/app/api/checkout/init/route'
import { applyPaymentSuccess } from '@/lib/payments/apply-payment-success'

type AuditInsert = { table: string; values: Record<string, unknown> }

function makeService(ledgerMessage?: string) {
  const inserts: AuditInsert[] = []
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: async () => ({ error: null }),
      insert: async (values: Record<string, unknown>) => {
        inserts.push({ table, values })
        return { error: null }
      },
    }
    return chain
  }
  const service = {
    from,
    rpc: async (name: string) => {
      if (name === 'write_commission_ledger' && ledgerMessage) {
        return { data: null, error: { message: ledgerMessage } }
      }
      return { data: null, error: null }
    },
  }
  return { service, inserts }
}

const paymentInput = {
  orderId: 7,
  orderKind: 'retail' as const,
  provider: 'intasend' as const,
  invoiceId: 'INV-7',
  providerRef: 'REF-7',
  receipt: 'RCPT-7',
  source: 'webhook' as const,
  rawPayload: {},
  actorId: null,
}

describe('P0 commerce safeguards', () => {
  it('returns HTTP 410 for bundle checkout policy responses', async () => {
    expect(hasBundleCheckoutLine([{ kind: 'bundle', bundleId: 1 }])).toBe(true)
    expect(hasBundleCheckoutLine([{ kind: 'variant', variantId: 1 }])).toBe(false)
    const response = bundleCheckoutGoneResponse()
    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toEqual({
      error: 'Bundle checkout is no longer available. Please shop individual fragrances.',
    })
  })

  it('keeps payment successful but flags and audits a ledger failure', async () => {
    const { service, inserts } = makeService('RPC unavailable')
    const result = await applyPaymentSuccess(service as never, paymentInput)
    expect(result.paid).toBe(true)
    expect(result.commissionFailed).toBe(true)
    expect(result.warnings).toContain('write_commission_ledger: RPC unavailable')
    expect(inserts.some((entry) => entry.table === 'audit_log' && entry.values.action === 'commission.ledger_write_failed')).toBe(true)
  })

  it('reports a healthy commission ledger without the failure flag', async () => {
    const { service, inserts } = makeService()
    const result = await applyPaymentSuccess(service as never, paymentInput)
    expect(result.paid).toBe(true)
    expect(result.commissionFailed).toBe(false)
    expect(inserts.some((entry) => entry.values.action === 'commission.ledger_write_failed')).toBe(false)
  })
})

