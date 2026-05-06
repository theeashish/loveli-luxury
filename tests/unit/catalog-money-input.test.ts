import { describe, it, expect } from 'vitest'
import {
  isValidKesInput,
  kesInputToMinor,
  minorToKesInput,
} from '../../src/lib/catalog/money-input'

describe('isValidKesInput', () => {
  it('accepts whole numbers and 1-2 decimal places', () => {
    expect(isValidKesInput('4000')).toBe(true)
    expect(isValidKesInput('4000.5')).toBe(true)
    expect(isValidKesInput('4000.55')).toBe(true)
    expect(isValidKesInput('  4000  ')).toBe(true)
  })

  it('rejects empty, negative, alphabetic, and >2 decimal inputs', () => {
    expect(isValidKesInput('')).toBe(false)
    expect(isValidKesInput('  ')).toBe(false)
    expect(isValidKesInput('-1')).toBe(false)
    expect(isValidKesInput('abc')).toBe(false)
    expect(isValidKesInput('4000.555')).toBe(false)
    expect(isValidKesInput('4,000')).toBe(false)
  })
})

describe('kesInputToMinor', () => {
  it('converts whole shillings to cents', () => {
    expect(kesInputToMinor('4000')).toBe('400000')
    expect(kesInputToMinor('1')).toBe('100')
  })

  it('handles 1- and 2-decimal cents', () => {
    expect(kesInputToMinor('4000.5')).toBe('400050')
    expect(kesInputToMinor('4000.55')).toBe('400055')
    expect(kesInputToMinor('0.01')).toBe('1')
  })

  it('throws on invalid input', () => {
    expect(() => kesInputToMinor('abc')).toThrow()
    expect(() => kesInputToMinor('-1')).toThrow()
  })

  it('round-trips with minorToKesInput', () => {
    for (const minor of ['0', '1', '99', '100', '400055', '12345678901234567']) {
      expect(kesInputToMinor(minorToKesInput(minor))).toBe(minor)
    }
  })
})

describe('minorToKesInput', () => {
  it('formats minor units back to whole.cc', () => {
    expect(minorToKesInput('0')).toBe('0.00')
    expect(minorToKesInput('1')).toBe('0.01')
    expect(minorToKesInput('100')).toBe('1.00')
    expect(minorToKesInput('400055')).toBe('4000.55')
  })

  it('handles values larger than Number.MAX_SAFE_INTEGER', () => {
    expect(minorToKesInput('9007199254740993000')).toBe('90071992547409930.00')
  })
})
