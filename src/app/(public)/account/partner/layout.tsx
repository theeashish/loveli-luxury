/**
 * /account/partner layout — role gate for the distributor portal.
 *
 * Three rules:
 *   - Not signed in   → /login?next=/account/partner
 *   - Signed in but no distributors row → /partners/signup
 *   - Distributor exists but inactive   → render with a banner; no portal
 *     features. (Phase 5 will add a re-activation flow; for now we want
 *     the user to see what's happening rather than redirect into a loop.)
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentDistributor } from '@/lib/distributors/current'
import { partnerTierForRank } from '@/lib/partners/tiers'

export const metadata = {
  title: 'Partner portal',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const NAV = [
  { href: '/account/partner', label: 'Overview' },
  { href: '/account/partner/network', label: 'Network' },
  { href: '/account/partner/commissions', label: 'Commissions' },
  { href: '/account/partner/earnings', label: 'Earnings' },
  { href: '/account/partner/share', label: 'Share' },
  { href: '/account/payouts', label: 'Payouts' },
  { href: '/account/partner/settings', label: 'Settings' },
] as const

export default async function DistributorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  // getSession() reads cookies locally; getUser() makes a network call that
  // can intermittently fail on Vercel Edge and produce a login bounce loop.
  // See /partners/signup/page.tsx for the long note.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?next=/account/partner')

  const distributor = await getCurrentDistributor()
  if (!distributor) redirect('/partners/signup')

  const tier = partnerTierForRank(distributor.currentRankPosition)

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Partner
        </p>
        <h1 className="mt-2 font-serif text-4xl italic tracking-tight">
          {tier.displayName}
        </h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Your sponsor code:{' '}
          <code className="font-mono text-[hsl(var(--primary))]">
            {distributor.sponsorCode}
          </code>
        </p>
      </header>

      {!distributor.isActive ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your partner account is currently <strong>inactive</strong>.
          Contact the concierge to reactivate.
        </div>
      ) : null}

      <nav className="mb-8 flex gap-2 overflow-x-auto border-b border-[hsl(var(--border))] text-xs uppercase tracking-[0.2em]">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="-mb-px border-b-2 border-transparent px-3 py-3 text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}
