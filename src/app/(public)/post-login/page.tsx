/**
 * /post-login — smart routing after Supabase sign-in.
 *
 * LoginForm hard-navs here on success (unless an explicit safe `next`
 * was provided). This page runs server-side and routes the user to the
 * right surface for their role:
 *
 *   1. Explicit ?next= (validated) → honour it
 *   2. admin / superadmin role     → /admin
 *   3. has distributors row        → /account/partner
 *   4. default (buyer)             → /shop  (browse-first; cart is the buyer's "account")
 *
 * The redirect happens BEFORE any layout streams — this page never
 * renders. If the user lands here unauthenticated, send them back to
 * /login.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { safeNext } from '@/lib/auth/safe-next'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Signing you in…',
  robots: { index: false, follow: false },
}

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const explicitNext = safeNext(searchParams.next)
  if (explicitNext) {
    redirect(explicitNext)
  }

  // Role check via service-role (bypasses RLS). user_roles has admin
  // policies that would otherwise hide other users' rows; using the
  // service client lets us read this user's role without any extra DB
  // round trip for the JWT claims.
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

  if (roles.has('admin') || roles.has('superadmin')) {
    redirect('/admin/catalog')
  }

  if (distRes.data) {
    redirect('/account/partner')
  }

  // Default — buyer/customer. Send them to the shop, not orders. Their
  // primary task is buying perfume; order history is one click away
  // from the header.
  redirect('/shop')
}
