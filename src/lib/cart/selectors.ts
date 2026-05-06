/**
 * Pure cart selectors. Returns BigInt totals; format with formatKes() at the
 * render edge.
 */

import type { BundleCartLine, CartLine } from './types'

type LinesContainer = { lines: readonly CartLine[] }

export function lineTotalMinor(line: CartLine): bigint {
  return BigInt(line.unitPriceMinor) * BigInt(line.qty)
}

export function totalQty(state: LinesContainer): number {
  let n = 0
  for (const l of state.lines) n += l.qty
  return n
}

export function subtotalMinor(state: LinesContainer): bigint {
  let total = 0n
  for (const l of state.lines) total += lineTotalMinor(l)
  return total
}

/**
 * Per-bundle savings versus buying every contained variant individually at
 * retail. Returns 0n if the line carries no à-la-carte snapshot or if the
 * bundle is at par / above à-la-carte (defensive — should not happen for
 * legitimate bundles, but the math handles it).
 */
export function bundleSavingsMinor(line: BundleCartLine): bigint {
  if (!line.alaCarteTotalMinor) return 0n
  const ala = BigInt(line.alaCarteTotalMinor) * BigInt(line.qty)
  const paid = lineTotalMinor(line)
  return ala > paid ? ala - paid : 0n
}

export function totalBundleSavingsMinor(state: LinesContainer): bigint {
  let total = 0n
  for (const l of state.lines) {
    if (l.kind === 'bundle') total += bundleSavingsMinor(l)
  }
  return total
}

export function isEmpty(state: LinesContainer): boolean {
  return state.lines.length === 0
}
