/**
 * Header auth slot.
 *
 * Signed-out: explicit "Log in" + "Sign up" text links.
 * Signed-in:  identity strip ([email] · [ROLE]) acting as the Account
 *             link, plus a separate Sign out form button.
 *
 * Account destination + role label by user state:
 *   - has distributor row              → /account/partner   · PARTNER
 *   - admin / superadmin role          → /admin/catalog          · ADMIN
 *   - else (default)                    → /account/orders         · CUSTOMER
 *
 * Server component (cookie-only session read via getSession; matches
 * the pattern AffiliateUpgradeLink uses to avoid the Vercel login loop).
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { signOutAction } from '@/lib/auth/signout-action'

interface HeaderAuthProps {
  variant?: 'desktop' | 'mobile'
}

type RoleLabel = 'CUSTOMER' | 'PARTNER' | 'ADMIN'

const ROLE_STYLES: Record<RoleLabel, string> = {
  CUSTOMER:
    'border-[hsl(var(--muted-foreground))]/30 text-[hsl(var(--muted-foreground))]',
  PARTNER:
    'border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]',
  ADMIN: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
}

export async function HeaderAuth({ variant = 'desktop' }: HeaderAuthProps) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const desktopLinkCls =
    'text-xs uppercase tracking-[0.25em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]'
  const mobileLinkCls =
    'block w-full py-3 text-left text-sm uppercase tracking-[0.25em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]'
  const linkCls = variant === 'desktop' ? desktopLinkCls : mobileLinkCls

  if (!session?.user) {
    return (
      <>
        <Link href="/login" className={linkCls}>
          Log in
        </Link>
        <Link href="/signup" className={linkCls}>
          Sign up
        </Link>
      </>
    )
  }

  const service = createServiceClient()
  const [rolesRes, distRes] = await Promise.all([
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
  ])

  const roles = new Set(
    ((rolesRes.data ?? []) as Array<{ role: string }>).map((r) => r.role),
  )

  let accountHref = '/account/orders'
  let roleLabel: RoleLabel = 'CUSTOMER'
  if (distRes.data) {
    accountHref = '/account/partner'
    roleLabel = 'PARTNER'
  } else if (roles.has('admin') || roles.has('superadmin')) {
    accountHref = '/admin/catalog'
    roleLabel = 'ADMIN'
  }

  const email = session.user.email ?? 'signed in'
  const badgeCls = `inline-block rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.2em] ${ROLE_STYLES[roleLabel]}`

  if (variant === 'mobile') {
    return (
      <>
        <div className="mb-2 flex flex-col gap-2 pt-1">
          <p className="break-all text-xs text-[hsl(var(--muted-foreground))]">
            {email}
          </p>
          <span className={badgeCls}>{roleLabel}</span>
        </div>
        <Link href={accountHref} className={linkCls}>
          Account
        </Link>
        <form action={signOutAction} className="w-full">
          <button type="submit" className={linkCls}>
            Sign out
          </button>
        </form>
      </>
    )
  }

  return (
    <>
      <Link
        href={accountHref}
        className="group flex max-w-[18rem] items-center gap-2 text-xs uppercase tracking-[0.25em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
        title={email}
      >
        <span className="hidden truncate normal-case tracking-normal text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] lg:inline">
          {email}
        </span>
        <span className={badgeCls}>{roleLabel}</span>
      </Link>
      <form action={signOutAction}>
        <button type="submit" className={desktopLinkCls}>
          Sign out
        </button>
      </form>
    </>
  )
}
