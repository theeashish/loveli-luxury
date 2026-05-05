/**
 * Money handling for Loveli Luxury International.
 *
 * Rules:
 * 1. All amounts in the codebase are BigInt minor units (cents). 1 KES = 100 cents.
 * 2. Floats are NEVER used for money. They cause silent rounding errors at scale.
 * 3. Display formatting happens at the edge, not in business logic.
 * 4. Percentages are basis points integers. 20% = 2000 bp. 1.5% = 150 bp. 0.01% = 1 bp.
 * 5. All commission and salary calculations use only +, -, *, / on bigints. Integer
 *    division truncates toward zero, which is the intended rounding for payouts.
 */

export type MinorUnits = bigint
export type BasisPoints = number

// -----------------------------------------------------------------------------
// Conversions
// -----------------------------------------------------------------------------

/** KES whole shillings to minor units (cents). 100 KES → 10000n */
export function kesToMinor(kes: number): MinorUnits {
  if (!Number.isFinite(kes)) {
    throw new Error(`kesToMinor received non-finite number: ${kes}`)
  }
  // Round to avoid floating-point garbage like 0.1 + 0.2 = 0.30000000000000004
  return BigInt(Math.round(kes * 100))
}

/** Minor units back to KES whole shillings as a number, for display only */
export function minorToKes(minor: MinorUnits): number {
  return Number(minor) / 100
}

// -----------------------------------------------------------------------------
// Percentage calculations
// -----------------------------------------------------------------------------

/**
 * Apply a basis-points rate to an amount in minor units.
 *
 * Examples:
 *   applyBasisPoints(400000n, 2000)  // 20% of Kes 4,000 = Kes 800 → 80000n
 *   applyBasisPoints(720000n, 900)   // 9% of Kes 7,200 = Kes 648 → 64800n
 *
 * Truncates toward zero. This is the documented behaviour for commission
 * payouts in the comp plan.
 */
export function applyBasisPoints(amount: MinorUnits, rateBasisPoints: BasisPoints): MinorUnits {
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new Error(`Invalid basis points: ${rateBasisPoints}. Must be a non-negative integer.`)
  }
  return (amount * BigInt(rateBasisPoints)) / 10000n
}

// -----------------------------------------------------------------------------
// Sums
// -----------------------------------------------------------------------------

/** Sum a list of minor amounts safely */
export function sumMinor(amounts: readonly MinorUnits[]): MinorUnits {
  return amounts.reduce((acc, n) => acc + n, 0n)
}

// -----------------------------------------------------------------------------
// Formatting (display-only)
// -----------------------------------------------------------------------------

/** Format minor units for display in KES, with thousands separators */
export function formatKes(minor: MinorUnits): string {
  const kes = minorToKes(minor)
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(kes)
}

/** Format basis points for display, e.g. 2000 → "20%" */
export function formatBasisPoints(bp: BasisPoints): string {
  const pct = bp / 100
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`
}
