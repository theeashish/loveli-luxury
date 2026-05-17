/**
 * Affiliate upgrade email follow-up (DEFERRED — Phase A6 dependency).
 *
 * Trigger: N days after a buyer's first paid retail order, if they have
 * not yet become a distributor.
 *
 * Implementation requires Resend to be wired. Phase A audit calls this
 * Phase A6 (Sentry first, rate limiting second, 2FA third) — bring
 * Resend up alongside one of those, then implement this stub.
 *
 * Until then, exporting the type + no-op so calling code compiles.
 */

import 'server-only'

export interface AffiliateUpgradeEmailArgs {
  /** Auth user id, used for resend dedup. */
  userId: string
  /** Recipient email. */
  to: string
  /** Display name for greeting. */
  fullName: string
  /** Order they just paid for — used in the email body. */
  orderNumber: string
  /** Sponsor code from cookie at order time, if any. Pre-fills the
   *  signup CTA so the recipient lands with their sponsor already set. */
  sponsorCode?: string | null
}

/**
 * TODO(phase-a6): implement via Resend.
 *   1. import { Resend } from 'resend' + getServerEnv().RESEND_API_KEY
 *   2. Render template (use a React Email template at
 *      src/lib/email/templates/AffiliateUpgrade.tsx for parity with
 *      other transactional emails when those land)
 *   3. resend.emails.send({ from, to, subject, html })
 *   4. Insert audit_log entry: action='email.affiliate_upgrade_sent'
 *      with recipient + sponsor — used as dedup key for the next call
 *   5. Wire to a scheduled job (Inngest in Phase C) that scans paid
 *      retail orders aged N days and calls this once per qualifying
 *      user.
 */
export async function sendAffiliateUpgradeEmail(
  _args: AffiliateUpgradeEmailArgs,
): Promise<{ skipped: true; reason: string }> {
  return {
    skipped: true,
    reason: 'Resend not wired — see Phase A6 in TODO.md',
  }
}
