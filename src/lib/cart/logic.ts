/**
 * Pure cart reducers. The Zustand store in store.ts wires these into a
 * persisted, reactive state container; here we keep the merge / cap / dedupe
 * rules in plain functions so they can be unit-tested without a DOM.
 *
 * Conventions:
 *   - All reducers return a NEW lines array. Inputs are treated as readonly.
 *   - Empty cart is represented as `lines.length === 0`. There is no "remove
 *     all" sentinel; clear simply replaces with [].
 *   - A line key is `<kind>:<id>` and is stable across qty changes.
 */

import type { CartLine, CartLineInput } from './types'

export function lineKey(line: CartLine | CartLineInput): string {
  return line.kind === 'variant'
    ? `variant:${line.variantId}`
    : `bundle:${line.bundleId}`
}

/**
 * Add an item to the cart. If the same kind+id is already present, qty is
 * summed. Variant lines are capped by their `inventoryAtAdd` snapshot when
 * one is known. qty <= 0 is a no-op.
 */
export function addLine(
  lines: readonly CartLine[],
  input: CartLineInput,
  qty: number,
): CartLine[] {
  if (!Number.isInteger(qty) || qty <= 0) return [...lines]

  const key = lineKey(input)
  const idx = lines.findIndex((l) => lineKey(l) === key)

  if (idx === -1) {
    const cappedQty =
      input.kind === 'variant' ? capByInventory(qty, input.inventoryAtAdd) : qty
    if (cappedQty <= 0) return [...lines]
    const fresh: CartLine =
      input.kind === 'variant'
        ? { ...input, qty: cappedQty }
        : { ...input, qty: cappedQty }
    return [...lines, fresh]
  }

  const existing = lines[idx] as CartLine
  const summed = existing.qty + qty
  const cappedSum =
    existing.kind === 'variant'
      ? capByInventory(summed, existing.inventoryAtAdd)
      : summed
  if (cappedSum <= 0) return lines.filter((_, i) => i !== idx)
  const next: CartLine =
    existing.kind === 'variant'
      ? { ...existing, qty: cappedSum }
      : { ...existing, qty: cappedSum }

  return lines.map((l, i) => (i === idx ? next : l))
}

/**
 * Set the qty for an existing line. qty <= 0 removes the line entirely.
 * Variant lines are capped by their inventory snapshot.
 */
export function setQty(
  lines: readonly CartLine[],
  key: string,
  qty: number,
): CartLine[] {
  if (!Number.isInteger(qty) || qty <= 0) {
    return lines.filter((l) => lineKey(l) !== key)
  }
  const next: CartLine[] = []
  for (const l of lines) {
    if (lineKey(l) !== key) {
      next.push(l)
      continue
    }
    if (l.kind === 'variant') {
      const capped = capByInventory(qty, l.inventoryAtAdd)
      if (capped <= 0) continue // inventory zero — drop the line
      next.push({ ...l, qty: capped })
    } else {
      next.push({ ...l, qty })
    }
  }
  return next
}

export function removeLine(lines: readonly CartLine[], key: string): CartLine[] {
  return lines.filter((l) => lineKey(l) !== key)
}

export function clearLines(): CartLine[] {
  return []
}

function capByInventory(desired: number, inv: number | null): number {
  if (inv === null) return desired
  if (inv <= 0) return 0
  return Math.min(desired, inv)
}
