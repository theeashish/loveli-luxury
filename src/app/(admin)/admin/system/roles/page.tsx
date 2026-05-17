/**
 * /admin/system/roles — superadmin grants/revokes admin + superadmin
 * roles across all users.
 *
 * Distributor role is excluded from the editable set: that role is
 * tied to a `distributors` row created by the provision_distributor
 * RPC on payment success. Toggling the role tag here without touching
 * the row would create inconsistent state.
 *
 * Page-level gate: shows a friendly "superadmin only" message if a
 * non-superadmin admin lands here, instead of redirecting. They can
 * still see the page exists, they just can't operate it.
 */

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { RolesTable, type UserRow } from '@/components/admin/RolesTable'

export const metadata = { title: 'User roles', robots: { index: false } }
export const dynamic = 'force-dynamic'

type RoleRowDb = { user_id: string; role: string }

export default async function RolesPage() {
  const session = await getSession()
  if (!session) redirect('/?reason=auth')

  if (!session.roles.has('superadmin')) {
    return (
      <div className="max-w-3xl">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
            System
          </p>
          <h1 className="mt-2 text-3xl font-semibold">User roles</h1>
        </header>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <p className="text-sm text-amber-900">
            Only <strong>superadmins</strong> can manage user roles. Your
            account has:{' '}
            <code className="rounded bg-white px-1">
              {[...session.roles].join(', ') || '(none)'}
            </code>
          </p>
          <p className="mt-3 text-xs text-amber-800">
            Ask an existing superadmin to grant you the role, or contact the
            site owner.
          </p>
        </div>
      </div>
    )
  }

  const service = createServiceClient()

  // Pull users (paginated; 100 covers everything for the foreseeable
  // future — bump perPage or paginate when it stops).
  const usersRes = await service.auth.admin.listUsers({ perPage: 100 })
  const users = usersRes.data?.users ?? []

  const rolesRes = await service
    .from('user_roles')
    .select('user_id, role')
    .is('revoked_at', null)

  const rolesByUser = new Map<string, string[]>()
  for (const r of (rolesRes.data ?? []) as RoleRowDb[]) {
    const list = rolesByUser.get(r.user_id) ?? []
    list.push(r.role)
    rolesByUser.set(r.user_id, list)
  }

  const rows: UserRow[] = users
    .map((u) => ({
      id: u.id,
      email: u.email ?? '(no email)',
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
    }))
    .sort((a, b) => a.email.localeCompare(b.email))

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          System
        </p>
        <h1 className="mt-2 text-3xl font-semibold">User roles</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Grant or revoke <strong>admin</strong> and <strong>superadmin</strong>{' '}
          across all users. Every action is logged. You cannot revoke your own
          superadmin role — that has to be done by another superadmin to
          prevent lock-outs.
        </p>
      </header>
      <RolesTable rows={rows} currentUserId={session.userId} />
    </div>
  )
}
