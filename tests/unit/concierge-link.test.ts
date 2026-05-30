/**
 * Tests for the WhatsApp Concierge link builder + message picker.
 * Pure functions; no env, no DOM.
 */

import { describe, expect, it } from 'vitest'
import {
  buildConciergeLink,
  buildConciergeMessage,
  normaliseWaPhone,
} from '../../src/lib/concierge/link'

describe('normaliseWaPhone', () => {
  it('strips the leading +', () => {
    expect(normaliseWaPhone('+254712345678')).toBe('254712345678')
  })
  it('strips spaces and dashes', () => {
    expect(normaliseWaPhone('+254 712-345-678')).toBe('254712345678')
  })
  it('leaves digits-only input alone', () => {
    expect(normaliseWaPhone('254712345678')).toBe('254712345678')
  })
})

describe('buildConciergeLink', () => {
  it('returns null on missing phone', () => {
    expect(buildConciergeLink(null)).toBeNull()
    expect(buildConciergeLink(undefined)).toBeNull()
    expect(buildConciergeLink('')).toBeNull()
    expect(buildConciergeLink('   ')).toBeNull()
  })

  it('returns null on phone that normalises too short', () => {
    expect(buildConciergeLink('+123')).toBeNull()
  })

  it('returns bare wa.me link when no message is supplied', () => {
    expect(buildConciergeLink('+254712345678')).toBe(
      'https://wa.me/254712345678',
    )
  })

  it('URL-encodes the message and appends as ?text=', () => {
    const url = buildConciergeLink('+254712345678', 'Hi & welcome — let’s talk')
    expect(url).toContain('?text=')
    expect(url).toContain('Hi%20%26%20welcome')
    expect(url).toContain('let%E2%80%99s')
  })

  it('survives emoji and newlines in the message', () => {
    const url = buildConciergeLink('+254712345678', 'Hi 👋\nNeed help')
    expect(url).toContain(encodeURIComponent('👋'))
    expect(url).toContain('%0A') // newline
  })
})

describe('buildConciergeMessage', () => {
  it('names the product on PDP paths', () => {
    expect(
      buildConciergeMessage({ pathname: '/p/rose-noir', productName: 'Rose Noir' }),
    ).toBe(
      'Hi Loveli Concierge, I\'m browsing Rose Noir and have a question.',
    )
  })

  it('falls back to generic on PDP without product name', () => {
    expect(
      buildConciergeMessage({ pathname: '/p/rose-noir' }),
    ).toBe('Hi Loveli Concierge, I\'d like help choosing a fragrance.')
  })

  it('names the bundle on bundle PDPs', () => {
    expect(
      buildConciergeMessage({
        pathname: '/bundles/founders-starter',
        bundleName: "Founder's Starter",
      }),
    ).toContain("Founder's Starter")
  })

  it('uses checkout tone on /cart and /checkout/*', () => {
    expect(buildConciergeMessage({ pathname: '/cart' })).toContain(
      'completing my order',
    )
    expect(
      buildConciergeMessage({ pathname: '/checkout/return' }),
    ).toContain('completing my order')
  })

  it('uses partner-program tone on partner account paths', () => {
    expect(
      buildConciergeMessage({ pathname: '/partners/signup' }),
    ).toContain('partner program')
    expect(
      buildConciergeMessage({ pathname: '/account/partner' }),
    ).toContain('partner program')
  })

  it('uses tracking tone on /track/* paths', () => {
    expect(
      buildConciergeMessage({ pathname: '/track/LL-2026-000021' }),
    ).toContain('update on my order')
  })

  it('default copy on home + other pages', () => {
    expect(buildConciergeMessage({ pathname: '/' })).toBe(
      'Hi Loveli Concierge, I\'d like help choosing a fragrance.',
    )
    expect(buildConciergeMessage({ pathname: '/shop' })).toBe(
      'Hi Loveli Concierge, I\'d like help choosing a fragrance.',
    )
  })
})
