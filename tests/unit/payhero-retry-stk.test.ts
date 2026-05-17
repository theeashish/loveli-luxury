/**
 * Tests for POST /api/payhero/retry-stk.
 *
 * The retry endpoint is the StkPushPanel's "Try again" target. The
 * contract:
 *
 *   1. Refires PayHero STK push against the SAME existing pending
 *      order owned by the caller. No new order is created.
 *   2. 401 if no session.
 *   3. 400 on malformed body.
 *   4. 404 when the order doesn't exist.
 *   5. 403 when the order belongs to someone else.
 *   6. 409 when the order is no longer pending (already paid /
 *      cancelled / expired).
 *   7. 502 when the payment provider call throws.
 *
 * Env vars are set before module import so the env.ts schema validates.
 * Supabase + dispatcher are mocked via vi.mock.
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

// ---------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------

type AuthUser = { id: string } | null

let mockUser: AuthUser = { id: 'user-uuid-1' }
let mockOrderRow: Record<string, unknown> | null = null
let mockOrderError: { message: string } | null = null
let mockProfileRow: Record<string, unknown> | null = {
  full_name: 'Test User',
}
type InitiatePaymentArgs = {
  orderId: number
  orderNumber: string
  amountKes: number
  customer: { email: string; name: string; phone: string }
  description: string
}

let initiatePaymentImpl: () => Promise<unknown> = async () => ({
  provider: 'payhero',
  status: 'stk_pushed',
  checkoutReference: 'phc_test',
})

const initiatePaymentMock = vi.fn<(args: InitiatePaymentArgs) => Promise<unknown>>(
  async () => initiatePaymentImpl(),
)

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: null }),
    },
  }),
}))

vi.mock('@/lib/supabase/service', () => {
  return {
    createServiceClient: () => ({
      from: (table: string) => {
        if (table === 'orders') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mockOrderRow,
                  error: mockOrderError,
                }),
              }),
            }),
          }
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: mockProfileRow,
                  error: mockProfileRow ? null : { message: 'not found' },
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      },
    }),
  }
})

vi.mock('@/lib/payments/dispatcher', () => ({
  initiatePayment: initiatePaymentMock,
}))

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function loadRoute() {
  return import('../../src/app/api/payhero/retry-stk/route')
}

function makeRequest(init: { body?: unknown; rawBody?: string }): Request {
  const body =
    init.rawBody !== undefined
      ? init.rawBody
      : init.body !== undefined
        ? JSON.stringify(init.body)
        : undefined
  return new Request('http://localhost/api/payhero/retry-stk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function basePendingOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    order_number: 'LL-2026-000042',
    status: 'pending',
    total_minor: '500000',
    user_id: 'user-uuid-1',
    customer_email: 'buyer@example.com',
    customer_phone: '+254700000000',
    ...overrides,
  }
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

describe('POST /api/payhero/retry-stk', () => {
  beforeEach(() => {
    mockUser = { id: 'user-uuid-1' }
    mockOrderRow = basePendingOrder()
    mockOrderError = null
    mockProfileRow = { full_name: 'Test User' }
    initiatePaymentImpl = async () => ({
      provider: 'payhero',
      status: 'stk_pushed',
      checkoutReference: 'phc_test',
    })
    initiatePaymentMock.mockClear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session is present', async () => {
    mockUser = null
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(401)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid JSON', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ rawBody: '{not-json' }))
    expect(res.status).toBe(400)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 400 when body is missing orderNumber', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ body: {} }))
    expect(res.status).toBe(400)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist', async () => {
    mockOrderRow = null
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-NOT-REAL' } }),
    )
    expect(res.status).toBe(404)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the order belongs to a different user', async () => {
    mockOrderRow = basePendingOrder({ user_id: 'someone-else-uuid' })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(403)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the order is already paid (no double-charge)', async () => {
    mockOrderRow = basePendingOrder({ status: 'paid' })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(409)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the order has been cancelled', async () => {
    mockOrderRow = basePendingOrder({ status: 'cancelled' })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(409)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 409 when the order has expired (the 15-min sweep flipped it)', async () => {
    mockOrderRow = basePendingOrder({ status: 'expired' })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(409)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 422 when the order has no phone on file', async () => {
    mockOrderRow = basePendingOrder({ customer_phone: null })
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(422)
    expect(initiatePaymentMock).not.toHaveBeenCalled()
  })

  it('returns 502 when the provider throws', async () => {
    initiatePaymentImpl = async () => {
      throw new Error('PayHero down')
    }
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(502)
    expect(initiatePaymentMock).toHaveBeenCalledTimes(1)
  })

  it('happy path: refires STK against the SAME order_number (no new order)', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      orderId: number
      orderNumber: string
      provider: string
      status: string
    }
    expect(body.orderId).toBe(42)
    expect(body.orderNumber).toBe('LL-2026-000042')
    expect(body.provider).toBe('payhero')

    expect(initiatePaymentMock).toHaveBeenCalledTimes(1)
    const call = initiatePaymentMock.mock.calls[0]![0]
    expect(call.orderId).toBe(42)
    expect(call.orderNumber).toBe('LL-2026-000042')
    expect(call.amountKes).toBe(5000) // 500000 minor / 100
    expect(call.customer.email).toBe('buyer@example.com')
    expect(call.customer.phone).toBe('+254700000000')
    expect(call.customer.name).toBe('Test User')
  })

  it('two retry calls in a row use the SAME order_number (no duplication)', async () => {
    const { POST } = await loadRoute()
    const r1 = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    const r2 = await POST(
      makeRequest({ body: { orderNumber: 'LL-2026-000042' } }),
    )
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)

    expect(initiatePaymentMock).toHaveBeenCalledTimes(2)
    const call1 = initiatePaymentMock.mock.calls[0]![0]
    const call2 = initiatePaymentMock.mock.calls[1]![0]
    expect(call1.orderNumber).toBe(call2.orderNumber)
    expect(call1.orderNumber).toBe('LL-2026-000042')
  })
})
