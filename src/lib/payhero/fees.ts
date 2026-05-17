/**
 * PayHero transaction fee calculator.
 *
 * Fee tiers verified against the PayHero pricing page (app.payhero.co.ke/pricing)
 * on cutover day. Tiers are stepwise: a transaction of X KES major
 * falls into the bucket where `from <= X <= to` and incurs the fee at
 * the end of that row.
 *
 * Pure function. No I/O. Money in minor units (cents) throughout.
 *
 * Usage:
 *   const subtotal = 1100000n;                   // Kes 11,000 in minor
 *   const fee = computePayHeroFeeMinor(subtotal); // 5000n  (Kes 50)
 *   const totalCharged = subtotal + fee;          // 1105000n
 */

interface FeeTier {
  /** Inclusive lower bound, KES major. */
  fromKes: number
  /** Inclusive upper bound, KES major. */
  toKes: number
  /** Fee, KES major. */
  feeKes: number
}

/**
 * Fee tiers as posted at https://app.payhero.co.ke/pricing.
 *
 * NOTE: PayHero's published table has one apparent typo (two rows
 * starting at 35,000 — the second is presumed to be 35,001 onwards).
 * The implementation treats the higher tier as authoritative.
 */
const FEE_TIERS: readonly FeeTier[] = [
  { fromKes:       1, toKes:      10, feeKes:   0 },
  { fromKes:      11, toKes:      49, feeKes:   1 },
  { fromKes:      50, toKes:     499, feeKes:   6 },
  { fromKes:     500, toKes:     999, feeKes:  10 },
  { fromKes:    1000, toKes:    1499, feeKes:  15 },
  { fromKes:    1500, toKes:    2499, feeKes:  20 },
  { fromKes:    2500, toKes:    3499, feeKes:  25 },
  { fromKes:    3500, toKes:    4999, feeKes:  30 },
  { fromKes:    5000, toKes:    7499, feeKes:  40 },
  { fromKes:    7500, toKes:    9999, feeKes:  45 },
  { fromKes:   10000, toKes:   14999, feeKes:  50 },
  { fromKes:   15000, toKes:   19999, feeKes:  55 },
  { fromKes:   20000, toKes:   34999, feeKes:  80 },
  { fromKes:   35000, toKes:   49999, feeKes: 105 },
  { fromKes:   50000, toKes:  149999, feeKes: 130 },
  { fromKes:  150000, toKes:  249999, feeKes: 160 },
  { fromKes:  250000, toKes:  349999, feeKes: 195 },
  { fromKes:  350000, toKes:  549999, feeKes: 230 },
  { fromKes:  550000, toKes:  749999, feeKes: 275 },
  { fromKes:  750000, toKes:  999999, feeKes: 320 },
] as const

/**
 * Highest tier fee — used when subtotal exceeds the largest published
 * bucket. We pin to the highest fee rather than 0; PayHero will charge
 * its actual rate when settling, and underestimating means the merchant
 * eats the gap.
 */
const FALLBACK_FEE_KES = FEE_TIERS[FEE_TIERS.length - 1]!.feeKes

/**
 * Compute the PayHero processing fee for a given order subtotal.
 * Both input and output are in MINOR units (KES cents).
 *
 * Zero-subtotal orders pay zero fee. Negative input is treated as 0.
 */
export function computePayHeroFeeMinor(subtotalMinor: bigint): bigint {
  if (subtotalMinor <= 0n) return 0n

  // Convert to KES major (rounded UP — if subtotal is fractional, the
  // fee tier should match what PayHero will see when it processes the
  // transaction in major units).
  const subtotalKes = Math.ceil(Number(subtotalMinor) / 100)

  for (const tier of FEE_TIERS) {
    if (subtotalKes >= tier.fromKes && subtotalKes <= tier.toKes) {
      return BigInt(tier.feeKes * 100)
    }
  }
  return BigInt(FALLBACK_FEE_KES * 100)
}

/**
 * Look up the fee tier itself (for display / breakdown UIs).
 * Returns null when subtotal is zero/negative.
 */
export function describePayHeroFeeTier(
  subtotalMinor: bigint,
): { tier: FeeTier; feeMinor: bigint } | null {
  if (subtotalMinor <= 0n) return null
  const subtotalKes = Math.ceil(Number(subtotalMinor) / 100)
  for (const tier of FEE_TIERS) {
    if (subtotalKes >= tier.fromKes && subtotalKes <= tier.toKes) {
      return { tier, feeMinor: BigInt(tier.feeKes * 100) }
    }
  }
  const lastTier = FEE_TIERS[FEE_TIERS.length - 1]!
  return { tier: lastTier, feeMinor: BigInt(FALLBACK_FEE_KES * 100) }
}
