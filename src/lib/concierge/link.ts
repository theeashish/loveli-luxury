/**
 * Build a wa.me link to the Loveli Concierge WhatsApp number.
 *
 * Pure function. The component layer reads
 * NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER from env at render time and
 * passes it here. Separating the encoding logic makes the component
 * untestable surface trivial and the testable surface explicit.
 *
 * wa.me accepts:
 *   - Phone in international format WITHOUT leading + or zeros
 *     (the prefix is implied by the country code).
 *   - `text` query param, URL-encoded.
 */

/** Strip the leading + from an E.164 number for wa.me compatibility. */
export function normaliseWaPhone(e164: string): string {
  return e164.replace(/^\+/, '').replace(/\s|-/g, '')
}

/**
 * Build the full WhatsApp Concierge URL.
 *
 * @param phoneE164  E.164 phone (with leading +); if empty or falsy,
 *                   returns null (caller renders nothing).
 * @param message    Optional plain-text prefilled message. Encoded for
 *                   safe URL inclusion (handles newlines + emoji).
 */
export function buildConciergeLink(
  phoneE164: string | null | undefined,
  message?: string,
): string | null {
  if (!phoneE164 || phoneE164.trim().length === 0) return null
  const phone = normaliseWaPhone(phoneE164)
  if (phone.length < 8) return null
  const base = `https://wa.me/${phone}`
  if (!message) return base
  return `${base}?text=${encodeURIComponent(message)}`
}

/**
 * Choose a context-aware prefilled message based on the current path.
 * - PDP (`/p/<slug>`): name the product if known.
 * - Bundle PDP (`/bundles/<slug>`): name the bundle.
 * - Cart / checkout: tone toward order completion.
 * - Anywhere else: generic Concierge intro.
 *
 * Pure function — caller injects the path + optional product name so
 * SSR + browser see the same message and there's no hydration mismatch.
 */
export function buildConciergeMessage(args: {
  pathname: string
  productName?: string | null
  bundleName?: string | null
}): string {
  const { pathname, productName, bundleName } = args
  if (pathname.startsWith('/p/') && productName) {
    return `Hi Loveli Concierge — I'm browsing ${productName} and have a question.`
  }
  if (pathname.startsWith('/bundles/') && bundleName) {
    return `Hi Loveli Concierge — I'm looking at the ${bundleName} bundle and have a question.`
  }
  if (pathname === '/cart' || pathname.startsWith('/checkout')) {
    return `Hi Loveli Concierge — I'm completing my order and need a quick hand.`
  }
  if (pathname.startsWith('/account/distributor') || pathname.startsWith('/partners')) {
    return `Hi Loveli Concierge — I have a question about the partner program.`
  }
  if (pathname.startsWith('/track/')) {
    return `Hi Loveli Concierge — I'd like an update on my order.`
  }
  return `Hi Loveli Concierge — I'd like help choosing a fragrance.`
}
