/**
 * /admin/system/users — superadmin-only user management.
 *
 * Lists every account in Supabase Auth with its current roles + ban state.
 * Each row exposes a "Deactivate" action that revokes roles, bans the
 * account, and anonymises the email so it can be re-registered. Self and
 * the four protected accounts (capernstone, ashishke79, ashirumaabala1,
 * rymiruzz) are guarded both server- and client-side.
 *
 * Authorization is double-gated: requireSuperadmin in the layout flow
 * (via this page's data fetch), and re-checked inside the deactivate
 * action so a stale session can't slip past.
 */

import { redirect } from 'next/navigation'
import { AuthError, getSession, isSuperadmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { UserRow } from './UserRow'

export const metadata = { title: 'User management', robots: { index: false } }
export const dynamic = 'force-dynamic'

type ListedUser = {
  id: string
  email: string | null
  createdAt: string | null
  roles: string[]
  banned: boolean
}

export default async function UsersAdminPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/admin/system/users')
  if (!isSuperadmin(session)) {
    throw new AuthError('FORBIDDEN')
  }

  const service = createServiceClient()
  const listRes = await service.auth.admin.listUsers({ perPage: 1000 })
  if (listRes.error) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold text-neutral-900">User management</h1>
        <p className="mt-4 rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          Failed to list users: {listRes.error.message}
        </p>
      </div>
    )
  }

  // Pull roles for the listed users in one round-trip.
  const userIds = listRes.data.users.map((u) => u.id)
  const rolesRes = await service
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', userIds)
    .is('revoked_at', null)
  const rolesByUser = new Map<string, string[]>()
  for (const r of rolesRes.data ?? []) {
    const arr = rolesByUser.get(r.user_id) ?? []
    arr.push(r.role)
    rolesByUser.set(r.user_id, arr)
  }

  const users: ListedUser[] = listRes.data.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
      banned:
        Boolean((u as { banned_until?: string | null }).banned_until) ||
        (u.email ?? '').endsWith('@deleted.local'),
    }))
    .sort((a, b) => {
      // Banned/deactivated to the bottom, then by created_at desc.
      if (a.banned !== b.banned) return a.banned ? 1 : -1
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-eyebrow text-neutral-500">System · superadmin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          User management
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Two actions. <strong>Deactivate</strong> revokes all roles, bans the
          account, anonymises the email, and inactivates any distributor row —
          reversible, preserves the financial audit trail. <strong>Delete
          permanently</strong> removes the auth user, profile, addresses, and
          distributor row entirely; it refuses when the user has audit-required
          financial history (earned commissions, payouts, or paid orders) and
          tells you exactly what's blocking. Protected accounts (
          <code className="rounded bg-neutral-100 px-1 text-xs">capernstone</code>,
          <code className="ml-1 rounded bg-neutral-100 px-1 text-xs">ashishke79</code>,
          <code className="ml-1 rounded bg-neutral-100 px-1 text-xs">ashirumaabala1</code>,
          <code className="ml-1 rounded bg-neutral-100 px-1 text-xs">rymiruzz</code>
          ) cannot be touched by either action through this UI.
        </p>
      </header>

      <ul className="space-y-3">
        {users.map((u) => (
          <UserRow key={u.id} user={u} isSelf={u.id === session.userId} />
        ))}
      </ul>
    </div>
  )
}
