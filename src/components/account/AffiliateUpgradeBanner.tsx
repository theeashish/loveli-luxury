/**
 * Reusable "Build a Boss Scents business" banner. Renders only when the
 * signed-in user is NOT yet a distributor. Reads ll_sponsor cookie so we
 * can mention "Your sponsor: LL-XX-XXXX" when the user landed through
 * a referral link.
 *
 * Embed wherever a buyer should see the upgrade prompt:
 *   - /account/orders (above the orders list)
 *   - /account (dashboard, when it exists)
 *   - /checkout/return (after a successful retail order)
 */

import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function AffiliateUpgradeBanner({
  variant = 'card',
}: {
  /** 'card' for full standalone block; 'inline' for compact strip variant. */
  variant?: 'card' | 'inline'
} = {}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return null

  const service = createServiceClient()
  const distRes = await service
    .from('distributors')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (distRes.data) return null

  const sponsor = cookies().get('ll_sponsor')?.value ?? null

  if (variant === 'inline') {
    return (
      <div className="rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--muted))]/40 px-4 py-3 text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">
          Want to earn from sharing the brand?{' '}
        </span>
        <Link
          href="/distributors/signup"
          className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          Become an affiliate →
        </Link>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-6 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(60% 80% at 100% 0%, hsl(38 56% 60% / 0.15) 0%, transparent 60%)',
        }}
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--primary))]">
        Boss Scents International
      </p>
      <h2 className="mt-3 font-serif text-3xl italic tracking-tight md:text-4xl">
        Build a Boss Scents business
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        Earn retail profit on every bottle you sell, plus 7 levels of network
        commission on Point Value. From Manager rank up, qualify for a lifetime
        monthly salary up to Kes 250,000.
      </p>
      {sponsor ? (
        <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          Your sponsor:{' '}
          <code className="font-mono text-[hsl(var(--primary))]">{sponsor}</code>
        </p>
      ) : null}
      <Link
        href="/distributors/signup"
        className="mt-6 inline-flex items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
      >
        Become an affiliate →
      </Link>
    </div>
  )
}
