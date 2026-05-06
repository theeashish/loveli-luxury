import { describe, it, expect } from 'vitest'
import { isValidSlug, slugify } from '../../src/lib/catalog/slug'

describe('isValidSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidSlug('rose')).toBe(true)
    expect(isValidSlug('rose-30ml')).toBe(true)
    expect(isValidSlug('a1-b2-c3')).toBe(true)
    expect(isValidSlug('x'.repeat(80))).toBe(true)
  })

  it('rejects malformed slugs', () => {
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('-rose')).toBe(false)
    expect(isValidSlug('rose-')).toBe(false)
    expect(isValidSlug('Rose')).toBe(false)
    expect(isValidSlug('rose--gold')).toBe(false)
    expect(isValidSlug('rose gold')).toBe(false)
    expect(isValidSlug('rose_gold')).toBe(false)
    expect(isValidSlug('x'.repeat(81))).toBe(false)
  })
})

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with hyphens', () => {
    expect(slugify('Rose Gold 30ml')).toBe('rose-gold-30ml')
  })

  it('strips diacritics via NFKD', () => {
    expect(slugify('Café Noir')).toBe('cafe-noir')
    expect(slugify('Pâtisserie')).toBe('patisserie')
  })

  it('expands ampersands to "and"', () => {
    expect(slugify('Lavender & Lemon')).toBe('lavender-and-lemon')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('   --hello--   ')).toBe('hello')
  })

  it('collapses runs of separators', () => {
    expect(slugify('A   B___C!!!D')).toBe('a-b-c-d')
  })

  it('truncates to 80 chars and never leaves a trailing hyphen', () => {
    const longInput = 'word '.repeat(40).trim()
    const out = slugify(longInput)
    expect(out.length).toBeLessThanOrEqual(80)
    expect(out.endsWith('-')).toBe(false)
  })

  it('produces a slug that passes isValidSlug for normal input', () => {
    expect(isValidSlug(slugify('Loveli Luxury 50ml — Rose Gold'))).toBe(true)
  })

  it('returns empty string for input with no alphanumerics', () => {
    expect(slugify('---!!!---')).toBe('')
  })
})
