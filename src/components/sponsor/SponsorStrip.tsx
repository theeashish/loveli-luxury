/**
 * SponsorStrip — slim attribution disclosure shown on cart + checkout.
 *
 * Reads the ll_sponsor cookie set by middleware (either from a ?ref=
 * referral link or from the default-sponsor fallback for SEO traffic).
 * Renders nothing in the transitional pre-bootstrap state when no
 * founder exists and the cookie is therefore unset.
 *
 * Server component — does the cookie read here so the client component
 * only owns the interactive bits.
 */

import { cookies } from 'next/headers'
import { SponsorStripClient } from './SponsorStripClient'

export function SponsorStrip() {
  const sponsor = cookies().get('ll_sponsor')?.value
  if (!sponsor) return null
  return <SponsorStripClient currentCode={sponsor} />
}
