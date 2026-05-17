'use server'

/**
 * Server actions for /admin/system/roles.
 *
 * Both actions defensively re-verify the actor is superadmin before
 * touching user_roles. The RLS policy `user_roles_super`
 * (001_initial_schema.sql:567) already restricts writes; this is
 * belt-and-braces so a misconfigured client can never escalate.
 *
 * Audited via audit_log so we can trace who promoted/demoted whom.
 */

import { revalidatePath } from 'next/cache'
import { getSession, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

type ManageableRole = 'admin' | 'superadmin'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session) throw new AuthError('UNAUTHENTICATED')
  if (!session.roles.has('superadmin')) throw new AuthError('FORBIDDEN')
  return session
}

export async function grantRoleAction(
  targetUserId: string,
  role: ManageableRole,
): Promise<{ ok: boolean; error?: string }> {
  if (role !== 'admin' && role !== 'superadmin') {
    return { ok: false, error: 'Only admin and superadmin are manageable here.' }
  }

  let actor
  try {
    actor = await requireSuperadmin()
  } catch {
    return { ok: false, error: 'Forbidden — superadmin only.' }
  }

  const service = createServiceClient()

  // TODO(types): regenerate database.ts so user_roles exposes id and
  // granted_by — the live DB has them (001_initial_schema.sql:51-59)
  // but the generated types are stale. Cast through unknown until then.
  const rolesTable = service.from('user_roles') as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: { id: number; revoked_at: string | null } | null
            error: { message: string } | null
          }>
        }
      }
    }
    update: (patch: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
    }
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }

  // Check for an existing row (possibly revoked) so we resurrect rather
  // than fail on the UNIQUE(user_id, role) constraint.
  const existingRes = await rolesTable
    .select('id, revoked_at')
    .eq('user_id', targetUserId)
    .eq('role', role)
    .maybeSingle()
  const existing = existingRes.data

  if (existing) {
    if (!existing.revoked_at) {
      return { ok: false, error: 'User already has this role.' }
    }
    const upd = await rolesTable
      .update({
        revoked_at: null,
        granted_by: actor.userId,
        granted_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (upd.error) return { ok: false, error: upd.error.message }
  } else {
    const ins = await rolesTable.insert({
      user_id: targetUserId,
      role,
      granted_by: actor.userId,
    })
    if (ins.error) return { ok: false, error: ins.error.message }
  }

  await service.from('audit_log').insert({
    actor_id: actor.userId,
    action: 'user_roles.granted',
    resource_type: 'user_roles',
    resource_id: targetUserId,
    after_data: { role, granted_by: actor.userId },
  })

  revalidatePath('/admin/system/roles')
  return { ok: true }
}

export async function revokeRoleAction(
  targetUserId: string,
  role: ManageableRole,
): Promise<{ ok: boolean; error?: string }> {
  if (role !== 'admin' && role !== 'superadmin') {
    return { ok: false, error: 'Only admin and superadmin are manageable here.' }
  }

  let actor
  try {
    actor = await requireSuperadmin()
  } catch {
    return { ok: false, error: 'Forbidden — superadmin only.' }
  }

  // Lock-out prevention: a superadmin cannot revoke their own
  // superadmin role. They must have another superadmin do it.
  if (targetUserId === actor.userId && role === 'superadmin') {
    return {
      ok: false,
      error: 'You cannot revoke your own superadmin role. Ask another superadmin.',
    }
  }

  const service = createServiceClient()

  const upd = await service
    .from('user_roles')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', targetUserId)
    .eq('role', role)
    .is('revoked_at', null)
  if (upd.error) return { ok: false, error: upd.error.message }

  await service.from('audit_log').insert({
    actor_id: actor.userId,
    action: 'user_roles.revoked',
    resource_type: 'user_roles',
    resource_id: targetUserId,
    after_data: { role, revoked_by: actor.userId },
  })

  revalidatePath('/admin/system/roles')
  return { ok: true }
}
