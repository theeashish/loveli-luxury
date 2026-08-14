/**
 * Header auth slot.
 *
 * Signed-out desktop: Create account link with a Log in disclosure.
 * Signed-out mobile: explicit "Log in" + "Sign up" text links.
 * Signed-in:  identity strip ([email] Â· [ROLE]) acting as the Account
 *             link, plus a separate Sign out form button.
 *
 * Account destination + role label by user state:
 *   - has distributor row              â†’ /account/partner   Â· PARTNER
 *   - admin / superadmin role          â†’ /admin/catalog          Â· ADMIN
 *   - else (default)                    â†’ /account/orders         Â· CUSTOMER
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
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const desktopLinkCls =
    'text-xs font-semibold uppercase tracking-[0.1em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]'
  const mobileLinkCls =
    'block w-full py-3 text-left text-sm font-semibold uppercase tracking-[0.1em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]'
  const linkCls = variant === 'desktop' ? desktopLinkCls : mobileLinkCls

  if (!session?.user) {
    if (variant === 'desktop') {
      return (
        <div data-testid="desktop-auth-menu" className="group relative">
          <Link href="/signup" className={desktopLinkCls}>Create account</Link>
          <div className="invisible absolute right-0 top-full z-50 mt-3 min-w-40 translate-y-1 rounded-sm border border-[hsl(var(--border))]/70 bg-[hsl(var(--background))] p-1 opacity-0 shadow-[0_14px_32px_hsl(22_18%_12%/0.14)] transition duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <Link href="/login" className={`${desktopLinkCls} block rounded-sm px-3 py-2 hover:bg-[hsl(var(--muted))]/70`}>
              Log in
            </Link>
          </div>
        </div>
      )
    }

    return (
      <>
        <Link href="/login" className={mobileLinkCls}>
          Log in
        </Link>
        <Link href="/signup" className={mobileLinkCls}>
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
        className="group flex max-w-[18rem] items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
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
