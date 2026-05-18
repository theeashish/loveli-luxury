/**
 * Privacy-safe masking helpers for the public /track/[orderNumber]
 * page.
 *
 * The order-tracking surface is reachable by anyone with the order
 * number (no login). To stop the URL leaking PII, every customer-side
 * string we surface is masked: full name → first-letter-plus-stars per
 * word; phone → last-3-digits-only.
 *
 * Pure functions. The page handler calls these and passes the masked
 * outputs to the template.
 */

/**
 * Mask a recipient name word-by-word: keep the first letter, replace
 * the rest with asterisks of the original length. Preserves spacing
 * and case.
 *
 * Examples:
 *   maskRecipientName('Mary')               → 'M***'
 *   maskRecipientName('Mary Akinyi Achieng') → 'M*** A***** A******'
 *   maskRecipientName('M')                   → 'M'
 *   maskRecipientName('')                    → ''
 */
export function maskRecipientName(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((word) => {
      if (word.length <= 1) return word
      return `${word[0]}${'*'.repeat(word.length - 1)}`
    })
    .join(' ')
}

/**
 * Mask a phone number to its last 3 digits (in E.164 input form).
 * Examples:
 *   maskPhone('+254712345678') → '+254 *** *** 678'
 *   maskPhone('+1 555 1234')   → '+1 *** *** 234'
 *   maskPhone('')              → ''
 */
export function maskPhone(input: string | null | undefined): string {
  if (!input) return ''
  const digitsOnly = input.replace(/\D/g, '')
  if (digitsOnly.length < 4) return input
  const last3 = digitsOnly.slice(-3)
  // Reuse the leading +<country> from the input when present.
  const m = input.match(/^\+\d{1,3}/)
  const leading = m ? m[0] : `+${digitsOnly.slice(0, digitsOnly.length - 3 - 6).slice(0, 3)}`
  return `${leading} *** *** ${last3}`
}

/**
 * Mask an email so the local part is reduced to first-letter only.
 *   maskEmail('mary.achieng@example.com') → 'm***@example.com'
 */
export function maskEmail(input: string | null | undefined): string {
  if (!input) return ''
  const at = input.indexOf('@')
  if (at < 1) return input
  const local = input.slice(0, at)
  const domain = input.slice(at)
  return `${local[0]}${'*'.repeat(Math.max(2, local.length - 1))}${domain}`
}
