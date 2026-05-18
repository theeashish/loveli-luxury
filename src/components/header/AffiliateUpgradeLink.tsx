/**
 * Header "Join the partner program" link. Rendered only for signed-in
 * users who:
 *   - have NO admin/superadmin role (admins don't need this CTA), and
 *   - have NO distributors row (existing partners don't need it).
 *
 * Server component — runs at the layout level. No extra round trip on
 * the client.
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function AffiliateUpgradeLink() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) return null

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

  // Hide for admins (no need) and existing partners (already in).
  if (roles.has('admin') || roles.has('superadmin')) return null
  if (distRes.data) return null

  return (
    <Link
      href="/partners/signup"
      className="hidden text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--primary))] md:inline"
    >
      Partner program
    </Link>
  )
}
