/**
 * Locks in the corrected IntaSend webhook schemas against the ACTUAL
 * documented payloads (developers.intasend.com/docs/send-money-events,
 * /docs/payment-collection-events, /docs/chargeback-events — verified
 * 2026-07-26).
 *
 * The send-money schema previously used `state` instead of `status` for
 * the batch-level field, which would have silently failed to extract
 * the real field from every live webhook (it still parsed via
 * `.passthrough()`, but the dedicated `state` field would always be
 * `undefined`). This test pins the real shape so that regression can't
 * silently return.
 */
import { describe, it, expect } from 'vitest'
import {
  webhookCollectionSchema,
  webhookSendMoneySchema,
  webhookChargebackSchema,
} from '@/lib/intasend/types'

describe('webhookCollectionSchema', () => {
  it('parses the documented collection payload', () => {
    const payload = {
      invoice_id: 'BRZKGPR',
      state: 'PROCESSING',
      provider: 'CARD-PAYMENT',
      charges: '0.00',
      net_amount: '10.36',
      currency: 'KES',
      value: '10.36',
      account: 'jane@example.com',
      api_ref: 'ISL_faa26ef9-eb08-4353-b125-ec6a8f022815',
      host: 'https://sandbox.intasend.com',
      failed_reason: null,
      created_at: '2021-08-18T12:33:50.425886+03:00',
      updated_at: '2021-08-18T12:33:51.304105+03:00',
      challenge: 'testnet',
    }
    const parsed = webhookCollectionSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.invoice_id).toBe('BRZKGPR')
      expect(parsed.data.state).toBe('PROCESSING')
    }
  })
})

describe('webhookSendMoneySchema', () => {
  const realPayload = {
    file_id: '0VZ4MOK',
    tracking_id: 'f89r8b57-f647-4960-933a-63874746005f',
    batch_reference: null,
    status: 'Completed',
    status_code: 'BC100',
    transactions: [
      {
        transaction_id: 'YP3I6V4',
        status: 'Successful',
        status_code: 'TS100',
        status_description: 'The service request is processed successfully.',
        request_reference_id: 'cik94566-9c1c-4db0-94f7-a1b344d99fd4',
        provider: 'MPESA-B2C',
        bank_code: null,
        name: 'Jane Doe',
        account: '254712345678',
        account_type: null,
        account_reference: null,
        provider_reference: 'TJRHC8IET4',
        provider_account_name: ' Jane Doe',
        amount: '38.00',
        charge: '10.00',
        narrative: 'airtime needed',
        file_id: '08Z4GOK',
        idempotency_key: null,
        currency: 'KES',
        created_at: '2025-10-27T10:44:23.852593+03:00',
        updated_at: '2025-10-27T10:44:39.017422+03:00',
      },
    ],
    actual_charges: '10.00',
    paid_amount: '38.00',
    failed_amount: 0.0,
    total_amount: '38.00',
    transactions_count: 1,
    created_at: '2025-10-27T10:44:23.775560+03:00',
    updated_at: '2025-10-27T10:44:39.042040+03:00',
  }

  it('parses the real documented send-money payload', () => {
    const parsed = webhookSendMoneySchema.safeParse(realPayload)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.tracking_id).toBe('f89r8b57-f647-4960-933a-63874746005f')
      // The regression this test guards against: the field is `status`,
      // not `state`.
      expect(parsed.data.status).toBe('Completed')
      expect(parsed.data.transactions?.[0]?.status).toBe('Successful')
      expect(parsed.data.transactions?.[0]?.provider_reference).toBe('TJRHC8IET4')
    }
  })

  it('does not require a challenge field (docs example omits it)', () => {
    const parsed = webhookSendMoneySchema.safeParse(realPayload)
    expect(parsed.success).toBe(true)
  })
})

describe('webhookChargebackSchema', () => {
  it('parses the documented chargeback payload', () => {
    const payload = {
      chargeback_id: 'VYBBVY4',
      transaction: { value: '103.63' },
      invoice: {
        invoice_id: 'VQ3X4OY',
        state: 'COMPLETE',
        api_ref: 'ISL_faa26ef9-eb08-4353-b125-ec6a8f022815',
      },
      amount: '103.63',
      reason: 'Unavailable service',
      status: 'PENDING',
      resolution: null,
      staff_created: false,
      created_at: '2021-08-18T12:20:20.858491+03:00',
      updated_at: '2021-08-18T12:20:20.858509+03:00',
      challenge: 'testnet',
    }
    const parsed = webhookChargebackSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.chargeback_id).toBe('VYBBVY4')
      expect(parsed.data.invoice?.invoice_id).toBe('VQ3X4OY')
    }
  })

  it('rejects a chargeback payload missing the mandatory challenge', () => {
    const parsed = webhookChargebackSchema.safeParse({
      chargeback_id: 'VYBBVY4',
      status: 'PENDING',
    })
    expect(parsed.success).toBe(false)
  })
})
