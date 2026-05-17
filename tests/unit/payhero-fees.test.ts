/**
 * Unit tests for the PayHero fee tier calculator.
 * Pure function — no env/network deps.
 */

import { describe, expect, it } from 'vitest'
import {
  computePayHeroFeeMinor,
  describePayHeroFeeTier,
} from '../../src/lib/payhero/fees'

describe('computePayHeroFeeMinor — published tiers', () => {
  it.each([
    // [KES major subtotal, expected fee KES major]
    [1,        0],
    [10,       0],
    [11,       1],
    [49,       1],
    [50,       6],
    [499,      6],
    [500,     10],
    [999,     10],
    [1_000,   15],
    [1_499,   15],
    [1_500,   20],
    [2_499,   20],
    [2_500,   25],
    [3_499,   25],
    [3_500,   30],
    [4_999,   30],
    [5_000,   40],
    [7_499,   40],
    [7_500,   45],
    [9_999,   45],
    [10_000,  50],
    [11_000,  50],   // the Founders Starter at Kes 11,000 → Kes 50 fee
    [14_999,  50],
    [15_000,  55],
    [19_999,  55],
    [20_000,  80],
    [34_999,  80],
    [35_000, 105],
    [49_999, 105],
    [50_000, 130],
    [149_999, 130],
    [150_000, 160],
    [249_999, 160],
    [250_000, 195],
    [349_999, 195],
    [350_000, 230],
    [549_999, 230],
    [550_000, 275],
    [749_999, 275],
    [750_000, 320],
    [999_999, 320],
  ])('Kes %i subtotal → Kes %i fee', (subtotalKes, expectedFeeKes) => {
    const fee = computePayHeroFeeMinor(BigInt(subtotalKes * 100))
    expect(fee).toBe(BigInt(expectedFeeKes * 100))
  })
})

describe('computePayHeroFeeMinor — edge cases', () => {
  it('zero subtotal pays zero fee', () => {
    expect(computePayHeroFeeMinor(0n)).toBe(0n)
  })

  it('negative subtotal pays zero fee (defensive)', () => {
    expect(computePayHeroFeeMinor(-100n)).toBe(0n)
  })

  it('subtotal above the highest published tier falls back to top fee', () => {
    // 1,000,000 KES major — above the 999,999 cap of the highest row
    expect(computePayHeroFeeMinor(100_000_000n)).toBe(BigInt(320 * 100))
  })

  it('the 4k starter package falls into the 3500-4999 tier (Kes 30 fee)', () => {
    expect(computePayHeroFeeMinor(BigInt(4_000 * 100))).toBe(BigInt(30 * 100))
  })

  it('the 7k starter package falls into the 5000-7499 tier (Kes 40 fee)', () => {
    expect(computePayHeroFeeMinor(BigInt(7_000 * 100))).toBe(BigInt(40 * 100))
  })
})

describe('describePayHeroFeeTier — returns tier metadata', () => {
  it('returns the matching tier for a mid-bucket subtotal', () => {
    const result = describePayHeroFeeTier(BigInt(1_100_000)) // 11,000 KES
    expect(result).not.toBeNull()
    expect(result!.tier.fromKes).toBe(10_000)
    expect(result!.tier.toKes).toBe(14_999)
    expect(result!.feeMinor).toBe(BigInt(50 * 100))
  })

  it('returns null for zero subtotal', () => {
    expect(describePayHeroFeeTier(0n)).toBeNull()
  })
})
