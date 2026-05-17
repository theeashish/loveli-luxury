/**
 * AccountStatusCard — replaces the generic AffiliateUpgradeBanner on
 * /account/orders so the user can see, at a glance:
 *   - Who they're signed in as
 *   - Their current role (CUSTOMER / AFFILIATE / ADMIN)
 *   - How many distributor signup attempts are sitting pending
 *   - The right next-step CTA for their state
 *
 * For affiliates and admins this returns null — they shouldn't normally
 * land on /account/orders, and if they do, they don't need an upgrade
 * prompt. Defensive: if the layout sends them here we don't want stale
 * upsell copy.
 */

import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type Status =
  | { kind: 'signed_out' }
  | { kind: 'affiliate' }
  | { kind: 'admin' }
  | {
      kind: 'customer'
      email: string
      pendingSignupCount: number
      sponsor: string | null
    }

async function loadStatus(): Promise<Status> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return { kind: 'signed_out' }

  const service = createServiceClient()
  const [rolesRes, distRes, pendingRes] = await Promise.all([
    service
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .is('revoked_at', null),
    service
      .from('distributors')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    service
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('kind', 'distributor_signup')
      .eq('status', 'pending'),
  ])

  if (distRes.data) return { kind: 'affiliate' }

  const roles = new Set(
    ((rolesRes.data ?? []) as Array<{ role: string }>).map((r) => r.role),
  )
  if (roles.has('admin') || roles.has('superadmin')) return { kind: 'admin' }

  const sponsor = cookies().get('ll_sponsor')?.value ?? null

  return {
    kind: 'customer',
    email: session.user.email ?? 'signed in',
    pendingSignupCount: pendingRes.count ?? 0,
    sponsor,
  }
}

export async function AccountStatusCard() {
  const status = await loadStatus()

  if (status.kind !== 'customer') return null

  const { email, pendingSignupCount, sponsor } = status

  // No pending signup attempts → the classic "Build a Boss Scents business"
  // upgrade CTA, but with the signed-in identity surfaced so the user
  // knows whose account they're on.
  if (pendingSignupCount === 0) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-6 md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            background:
              'radial-gradient(60% 80% at 100% 0%, hsl(38 56% 60% / 0.15) 0%, transparent 60%)',
          }}
        />
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--primary))]">
            Boss Scents International
          </p>
          <span className="inline-block rounded-full border border-[hsl(var(--muted-foreground))]/30 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Customer
          </span>
        </div>
        <h2 className="mt-3 font-serif text-3xl italic tracking-tight md:text-4xl">
          Build a Boss Scents business
        </h2>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Signed in as <span className="font-mono">{email}</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          Earn retail profit on every bottle you sell, plus 7 levels of
          network commission on Point Value. From Manager rank up, qualify
          for a lifetime monthly salary up to Kes 250,000.
        </p>
        {sponsor ? (
          <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            Your sponsor:{' '}
            <code className="font-mono text-[hsl(var(--primary))]">
              {sponsor}
            </code>
          </p>
        ) : null}
        <Link
          href="/distributors/signup"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
        >
          Become an affiliate →
        </Link>
      </section>
    )
  }

  // Pending signup attempts present → contextual card that names the
  // truth: they tried, payment didn't confirm, here's the way forward.
  return (
    <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-amber-300">
          Account status
        </p>
        <span className="inline-block rounded-full border border-[hsl(var(--muted-foreground))]/30 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
          Customer
        </span>
      </div>
      <h2 className="mt-3 font-serif text-2xl italic tracking-tight md:text-3xl">
        {pendingSignupCount === 1
          ? '1 signup attempt waiting on payment'
          : `${pendingSignupCount} signup attempts waiting on payment`}
      </h2>
      <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
        Signed in as <span className="font-mono">{email}</span>
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-amber-100/90">
        You started the distributor signup but the M-Pesa payment never
        confirmed, so no affiliate account was created. The pending orders
        below are those attempts — they don't charge you anything until
        payment confirms.
      </p>
      {sponsor ? (
        <p className="mt-3 text-xs text-amber-100/80">
          Your sponsor:{' '}
          <code className="font-mono text-amber-200">{sponsor}</code>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/distributors/signup"
          className="inline-flex items-center justify-center rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
        >
          Start a fresh signup →
        </Link>
      </div>
    </section>
  )
}
