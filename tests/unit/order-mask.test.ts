/**
 * Privacy-mask helpers for /track/[orderNumber]. Pure functions; no DOM.
 */

import { describe, expect, it } from 'vitest'
import {
  maskEmail,
  maskPhone,
  maskRecipientName,
} from '../../src/lib/orders/mask'

describe('maskRecipientName', () => {
  it('returns empty for empty input', () => {
    expect(maskRecipientName('')).toBe('')
    expect(maskRecipientName(null)).toBe('')
    expect(maskRecipientName(undefined)).toBe('')
  })

  it('keeps single-character names alone', () => {
    expect(maskRecipientName('M')).toBe('M')
  })

  it('masks single word', () => {
    expect(maskRecipientName('Mary')).toBe('M***')
  })

  it('masks multi-word name word-by-word', () => {
    expect(maskRecipientName('Mary Akinyi Achieng')).toBe('M*** A***** A******')
  })

  it('preserves leading + trailing whitespace collapse', () => {
    expect(maskRecipientName('   John   Doe   ')).toBe('J*** D**')
  })

  it('preserves case (first letter only)', () => {
    expect(maskRecipientName('john doe')).toBe('j*** d**')
  })

  it('handles non-ASCII letters', () => {
    expect(maskRecipientName('Zoë Müller')).toBe('Z** M*****')
  })
})

describe('maskPhone', () => {
  it('returns empty for empty input', () => {
    expect(maskPhone(null)).toBe('')
    expect(maskPhone(undefined)).toBe('')
    expect(maskPhone('')).toBe('')
  })

  it('masks a Kenyan E.164 number to last 3 digits', () => {
    expect(maskPhone('+254712345678')).toBe('+254 *** *** 678')
  })

  it('masks an E.164 with spaces', () => {
    expect(maskPhone('+254 712 345 678')).toBe('+254 *** *** 678')
  })

  it('returns the original for inputs shorter than 4 digits', () => {
    expect(maskPhone('123')).toBe('123')
  })
})

describe('maskEmail', () => {
  it('returns empty for empty input', () => {
    expect(maskEmail(null)).toBe('')
  })

  it('reduces the local part to first letter + asterisks', () => {
    expect(maskEmail('mary.achieng@example.com')).toBe('m***********@example.com')
  })

  it('handles short local parts gracefully', () => {
    expect(maskEmail('m@x.io')).toBe('m**@x.io')
  })

  it('returns input unchanged when no @ present', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email')
  })
})
