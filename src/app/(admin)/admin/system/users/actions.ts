'use server'

/**
 * Superadmin-only user management actions.
 *
 * Per the canonical brand brief and the authorized-accounts memory, four
 * accounts are protected from deactivation regardless of who tries it:
 *   - capernstone@gmail.com (owner Ashish, site account)
 *   - ashishke79@gmail.com  (owner Ashish, founding distributor)
 *   - ashirumaabala1@gmail.com (dev/test, kept reversible)
 *   - rymiruzz@gmail.com    (Ruth Karimi — the CLIENT)
 *
 * "Deactivate" is the safe default: it revokes all roles, bans the user
 * in Supabase Auth for ~100 years, and anonymises the email so it can be
 * re-used. This is reversible by an engineer with DB access — strictly
 * better than a hard auth.admin.deleteUser which would cascade-orphan
 * downstream rows we want for audit.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSuperadmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

const PROTECTED_EMAILS = new Set<string>([
  'capernstone@gmail.com',
  'ashishke79@gmail.com',
  'ashirumaabala1@gmail.com',
  'rymiruzz@gmail.com',
])

export type DeactivateResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

const inputSchema = z.object({
  userId: z.string().uuid(),
  /** Typed confirmation — must match the user's email exactly. */
  confirmEmail: z.string().min(1),
})

export async function deactivateUser(
  raw: { userId: string; confirmEmail: string },
): Promise<DeactivateResult> {
  let session
  try {
    session = await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden — superadmin required' }
    throw err
  }

  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid request' }
  }
  const { userId, confirmEmail } = parsed.data

  if (userId === session.userId) {
    return { ok: false, error: 'You cannot deactivate your own account.' }
  }

  const service = createServiceClient()

  // Load the target user via admin API.
  const userRes = await service.auth.admin.getUserById(userId)
  if (userRes.error || !userRes.data.user) {
    return { ok: false, error: `User not found: ${userRes.error?.message ?? 'unknown'}` }
  }
  const target = userRes.data.user
  const targetEmail = target.email ?? ''

  if (PROTECTED_EMAILS.has(targetEmail.toLowerCase())) {
    return {
      ok: false,
      error: `Protected account (${targetEmail}). This account cannot be deactivated by policy — see the authorized-accounts memory.`,
    }
  }

  if (targetEmail.toLowerCase() !== confirmEmail.toLowerCase()) {
    return {
      ok: false,
      error: `Confirmation email did not match. Type "${targetEmail}" exactly.`,
    }
  }

  // 1. Revoke all roles (idempotent).
  const revokeRes = await service
    .from('user_roles')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (revokeRes.error) {
    return { ok: false, error: `Role revocation failed: ${revokeRes.error.message}` }
  }

  // 2. Ban for ~100 years + anonymise the email so it can be re-registered.
  const deletedSuffix = `deleted-${userId}@deleted.local`
  const banRes = await service.auth.admin.updateUserById(userId, {
    ban_duration: '876000h', // ~100 years
    email: deletedSuffix,
    user_metadata: {
      ...(target.user_metadata ?? {}),
      deactivated_at: new Date().toISOString(),
      deactivated_by: session.userId,
      original_email: targetEmail,
    },
  })
  if (banRes.error) {
    return {
      ok: false,
      error: `Auth update failed: ${banRes.error.message}. Roles were revoked but the account is not yet banned — re-run to complete.`,
    }
  }

  // 3. Audit.
  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'user.deactivated',
    resource_type: 'user',
    resource_id: userId,
    before_data: { email: targetEmail },
    after_data: {
      anonymised_email: deletedSuffix,
      banned_until_hours: 876000,
      revoked_roles_count: revokeRes.count ?? null,
    },
  })

  revalidatePath('/admin/system/users')
  return {
    ok: true,
    message: `Deactivated ${targetEmail}. Roles revoked, account banned, email anonymised. Reversible by engineer if needed.`,
  }
}
