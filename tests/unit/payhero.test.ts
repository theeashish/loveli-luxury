/**
 * Unit tests for the PayHero service. No network.
 *
 * env.ts validates public schema at module load time, so we set the
 * required vars BEFORE any import via vi.hoisted. PAYHERO_WEBHOOK_TOKEN
 * is set here too so verifyWebhookToken can compare against a known
 * value.
 */

import { describe, expect, it, vi } from 'vitest'

const FAKE_WEBHOOK_TOKEN = vi.hoisted(() => {
  const token = 'test-webhook-token-min-20-chars-long'
  process.env.NEXT_PUBLIC_APP_URL ||= 'https://example.com'
  process.env.NEXT_PUBLIC_APP_NAME ||= 'Loveli'
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'a'.repeat(40)
  process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ||= 'pk_test_xxx'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'a'.repeat(40)
  process.env.FLUTTERWAVE_SECRET_KEY ||= 'a'.repeat(20)
  process.env.FLUTTERWAVE_ENCRYPTION_KEY ||= 'a'.repeat(20)
  process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH ||= 'a'.repeat(32)
  process.env.REVALIDATE_SECRET ||= 'a'.repeat(40)
  process.env.PAYHERO_WEBHOOK_TOKEN = token
  process.env.PAYHERO_AUTH_TOKEN ||= 'pre-encoded-basic-token-xxxxxxxxxxxx'
  return token
})

import {
  normaliseMsisdn,
  verifyWebhookToken,
  deriveEventId,
  buildCallbackUrl,
} from '../../src/lib/payhero/service'
import {
  isSuccessfulCallback,
  isFailedCallback,
  type PayHeroCallback,
} from '../../src/lib/payhero/types'

// ---------------------------------------------------------------------
// normaliseMsisdn
// ---------------------------------------------------------------------

describe('normaliseMsisdn', () => {
  it('accepts already-normalised 254XXXXXXXXX', () => {
    expect(normaliseMsisdn('254712345678')).toBe('254712345678')
  })

  it('strips the leading + on E.164', () => {
    expect(normaliseMsisdn('+254712345678')).toBe('254712345678')
  })

  it('converts the leading 0 local format', () => {
    expect(normaliseMsisdn('0712345678')).toBe('254712345678')
  })

  it('prepends 254 to a 9-digit national number', () => {
    expect(normaliseMsisdn('712345678')).toBe('254712345678')
  })

  it('strips non-digits before normalising', () => {
    expect(normaliseMsisdn('+254-712 345 678')).toBe('254712345678')
    expect(normaliseMsisdn('(254) 712 345 678')).toBe('254712345678')
  })

  it('throws on inputs it cannot canonicalise', () => {
    expect(() => normaliseMsisdn('123')).toThrow(/Unrecognised/)
    expect(() => normaliseMsisdn('+1 555 1234567')).toThrow(/Unrecognised/)
  })
})

// ---------------------------------------------------------------------
// verifyWebhookToken — URL-based gate; no HMAC
// ---------------------------------------------------------------------

describe('verifyWebhookToken', () => {
  it('accepts the configured token verbatim', () => {
    expect(verifyWebhookToken(FAKE_WEBHOOK_TOKEN)).toBe(true)
  })

  it('rejects a wrong token', () => {
    expect(verifyWebhookToken('wrong-token-value-with-same-length-')).toBe(false)
  })

  it('rejects a null token', () => {
    expect(verifyWebhookToken(null)).toBe(false)
  })

  it('rejects a token of the wrong length without crashing', () => {
    expect(verifyWebhookToken('too-short')).toBe(false)
  })
})

// ---------------------------------------------------------------------
// buildCallbackUrl
// ---------------------------------------------------------------------

describe('buildCallbackUrl', () => {
  it('appends the webhook token as a query param', () => {
    const url = buildCallbackUrl('https://example.com', '/api/payhero/webhook')
    expect(url).toBe(
      `https://example.com/api/payhero/webhook?key=${encodeURIComponent(
        FAKE_WEBHOOK_TOKEN,
      )}`,
    )
  })

  it('handles base URL with trailing slash', () => {
    const url = buildCallbackUrl('https://example.com/', '/api/payhero/webhook')
    expect(url).toContain('/api/payhero/webhook')
    expect(url).toContain(`key=`)
  })
})

// ---------------------------------------------------------------------
// deriveEventId — for webhook_deliveries dedup
// ---------------------------------------------------------------------

describe('deriveEventId', () => {
  it('prefers PayHero reference (the UUID) when present', () => {
    const body = {
      reference: '6b71cb8b-638d-4b6e-9c7c-b0334a641e3a',
      external_reference: 'ORDER-1',
      status: 'SUCCESS',
    }
    expect(deriveEventId(body)).toBe('6b71cb8b-638d-4b6e-9c7c-b0334a641e3a')
  })

  it('falls back to CheckoutRequestID', () => {
    const body = {
      CheckoutRequestID: 'ws_CO_123',
      external_reference: 'ORDER-2',
      status: 'SUCCESS',
    }
    expect(deriveEventId(body)).toBe('ws_CO_123')
  })

  it('falls back to provider_reference (M-Pesa receipt)', () => {
    const body = {
      provider_reference: 'SKQ96C7K7H',
      external_reference: 'ORDER-3',
      status: 'SUCCESS',
    }
    expect(deriveEventId(body)).toBe('SKQ96C7K7H')
  })

  it('hashes the body when no ids are present (dedup still deterministic)', () => {
    const body = { random: 'thing' }
    const id1 = deriveEventId(body)
    const id2 = deriveEventId(body)
    expect(id1).toBe(id2)
    expect(id1.length).toBe(32)
  })
})

// ---------------------------------------------------------------------
// isSuccessfulCallback / isFailedCallback — narrow PayHero status
// ---------------------------------------------------------------------

describe('callback status narrowing', () => {
  const base: PayHeroCallback = {
    success: true,
    status: 'SUCCESS',
    external_reference: 'ORDER-1',
    reference: 'phc_xxx',
    provider: 'm-pesa',
    provider_reference: 'SKQ96C7K7H',
    third_party_reference: 'SKQ96C7K7H',
  }

  it('isSuccessfulCallback requires status=SUCCESS AND success=true', () => {
    expect(isSuccessfulCallback(base)).toBe(true)
    expect(isSuccessfulCallback({ ...base, success: false })).toBe(false)
    expect(isSuccessfulCallback({ ...base, status: 'FAILED' })).toBe(false)
    expect(isSuccessfulCallback({ ...base, status: 'QUEUED' })).toBe(false)
  })

  it('isFailedCallback catches status=FAILED and success=false', () => {
    expect(isFailedCallback(base)).toBe(false)
    expect(isFailedCallback({ ...base, status: 'FAILED' })).toBe(true)
    expect(isFailedCallback({ ...base, success: false })).toBe(true)
  })

  it('QUEUED is neither success nor failure (intermediate state)', () => {
    const queued: PayHeroCallback = { ...base, status: 'QUEUED' }
    expect(isSuccessfulCallback(queued)).toBe(false)
    expect(isFailedCallback(queued)).toBe(false)
  })
})
