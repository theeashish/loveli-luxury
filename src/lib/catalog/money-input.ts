/**
 * KES whole-number input helpers for admin forms.
 *
 * The catalog schemas accept prices as integer-string minor units. Admin users
 * type whole shillings (with optional .cc cents). These helpers translate
 * between the two representations without ever touching a float.
 */

const KES_INPUT_RE = /^\d{1,15}(?:\.\d{0,2})?$/

export function isValidKesInput(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length === 0) return false
  return KES_INPUT_RE.test(trimmed)
}

/** "4000" → "400000", "4000.5" → "400050", "4000.55" → "400055" */
export function kesInputToMinor(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/^(\d{1,15})(?:\.(\d{0,2}))?$/)
  if (!match) throw new Error(`Invalid KES input: ${input}`)
  const whole = match[1] ?? '0'
  const cents = (match[2] ?? '').padEnd(2, '0').slice(0, 2)
  return (BigInt(whole) * 100n + BigInt(cents || '0')).toString()
}

/** "400000" → "4000.00" */
export function minorToKesInput(minor: string): string {
  const value = BigInt(minor)
  const whole = value / 100n
  const cents = value % 100n
  return `${whole}.${cents.toString().padStart(2, '0')}`
}
