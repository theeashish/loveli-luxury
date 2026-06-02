/**
 * Tests for the pure parts of scripts/payhero-smoke.mjs.
 *
 * The smoke script itself is operator-driven (it does I/O against PayHero
 * and asks for confirmation). We can't safely unit-test the API-firing
 * path. But the MSISDN validator + normaliser are pure functions and they
 * gate the destructive paths — so they're exactly the parts that MUST be
 * unit-tested. A regression that lets a malformed phone through could cause
 * a real B2C transfer to the wrong number.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error -- the script is a .mjs not packaged for TS resolution;
// vitest loads it fine at runtime, the type miss is harmless.
import { validateMsisdn, normaliseMsisdn } from '../../scripts/payhero-smoke.mjs'

describe('payhero-smoke validators', () => {
  describe('validateMsisdn — strict E.164 +254XXXXXXXXX', () => {
    it('accepts a well-formed Kenyan E.164', () => {
      expect(validateMsisdn('+254712345678')).toEqual({ ok: true })
    })

    it('rejects 0712… (the most common operator mistake)', () => {
      const r = validateMsisdn('0712345678')
      expect(r.ok).toBe(false)
      expect((r as { reason: string }).reason).toMatch(/expected \+254/i)
    })

    it('rejects 254712345678 without the leading +', () => {
      const r = validateMsisdn('254712345678')
      expect(r.ok).toBe(false)
    })

    it('rejects empty / null / undefined', () => {
      expect(validateMsisdn('').ok).toBe(false)
      expect(validateMsisdn(null as unknown as string).ok).toBe(false)
      expect(validateMsisdn(undefined as unknown as string).ok).toBe(false)
    })

    it('rejects non-Kenyan E.164 numbers (script is KE-specific by design)', () => {
      expect(validateMsisdn('+447911123456').ok).toBe(false) // UK
      expect(validateMsisdn('+12025550100').ok).toBe(false) // US
    })

    it('rejects too-short / too-long', () => {
      expect(validateMsisdn('+25471234567').ok).toBe(false) // 8 digits after +254
      expect(validateMsisdn('+2547123456789').ok).toBe(false) // 10 digits
    })
  })

  describe('normaliseMsisdn — mirrors lib/payhero/service.ts', () => {
    it('passes a 254-prefixed digit string through', () => {
      expect(normaliseMsisdn('254712345678')).toBe('254712345678')
    })

    it('strips leading + then accepts', () => {
      expect(normaliseMsisdn('+254712345678')).toBe('254712345678')
    })

    it('converts 0XXXXXXXXX to 254XXXXXXXXX', () => {
      expect(normaliseMsisdn('0712345678')).toBe('254712345678')
    })

    it('converts bare 9-digit (no prefix) to 254-prefixed', () => {
      expect(normaliseMsisdn('712345678')).toBe('254712345678')
    })

    it('throws on unrecognised shapes (so a typo cannot reach the API)', () => {
      expect(() => normaliseMsisdn('123')).toThrow(/Unrecognised/i)
      expect(() => normaliseMsisdn('+447911123456')).toThrow(/Unrecognised/i)
    })
  })
})
