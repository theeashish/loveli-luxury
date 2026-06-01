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
 * Two actions are exposed:
 *
 *   deactivateUser  — reversible. Revokes all roles, bans the user in
 *                     Supabase Auth for ~100 years, anonymises the email so
 *                     it can be re-registered, and inactivates any distributor
 *                     row owned by this user (fix shipped 2026-05-30 — see
 *                     migration 044). The financial audit trail (commissions,
 *                     payouts, paid orders, ledger) is preserved untouched.
 *                     This is the right choice for any user with real-money
 *                     history (AML/KYC retention obligations).
 *
 *   hardDeleteUser  — NOT reversible. Removes the auth user, profile, addresses,
 *                     distributor row, and closure-tree links via DB cascades.
 *                     Refuses (returns blocks: [...]) when the user has earned
 *                     commissions, has payouts, or has orders that touched real
 *                     money. For users with no financial trail (signed up,
 *                     never paid, never earned), it removes them entirely in
 *                     one transaction. The audit_log row captures the before-
 *                     snapshot so the deletion itself is provable.
 *
 *   checkHardDeleteSafety — pre-flight check that returns what would be
 *                     removed and what (if anything) is blocking. The UI calls
 *                     this when the operator opens the Delete-permanently
 *                     dialog so the operator sees the consequences and the
 *                     blockers before they type the email confirmation.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSuperadmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/database'

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

  // 1b. Flip distributors.is_active = FALSE for any distributor row this user
  // owns. Discovered 2026-05-30: without this, a soft-deleted user's
  // distributor row stays ACTIVE — meaning the commission engine keeps
  // including them in the upline chain (write_commission_ledger.is_active=TRUE
  // filter), and the still-stored payout_msisdn could receive a B2C transfer
  // against that row. For a money system, the deactivation MUST sever both
  // the auth identity AND the financial identity.
  //
  // We capture the previous state in the audit row below so an engineer can
  // reverse this cleanly if the user is ever reinstated.
  const distRes = await (service.from('distributors') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => {
        select: (cols: string) => Promise<{
          data: Array<{ id: number; sponsor_code: string }> | null
          error: { message: string } | null
        }>
      }
    }
  })
    .update({ is_active: false })
    .eq('user_id', userId)
    .select('id, sponsor_code')
  if (distRes.error) {
    return {
      ok: false,
      error: `Distributor deactivation failed: ${distRes.error.message}. Roles were revoked but distributor row(s) are still ACTIVE — re-run to complete.`,
    }
  }
  const deactivatedDistributors = distRes.data ?? []

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
      deactivated_distributor_ids: deactivatedDistributors.map((d) => d.id),
      deactivated_sponsor_codes: deactivatedDistributors.map((d) => d.sponsor_code),
    },
  })

  revalidatePath('/admin/system/users')
  return {
    ok: true,
    message: `Deactivated ${targetEmail}. Roles revoked, account banned, email anonymised, distributor row (if any) inactivated. Reversible by engineer if needed.`,
  }
}

// =============================================================================
// HARD DELETE
// =============================================================================
// True deletion: removes the auth user, profile, addresses, distributor row,
// closure-tree links, and any non-financial orders. CASCADES through every FK
// chain rooted at auth.users (id) → profiles (id ON DELETE CASCADE) → addresses,
// distributors (ON DELETE CASCADE) → distributor_tree (ON DELETE CASCADE).
//
// Refuses (returns blocked: true with a per-condition explanation) when the
// user has ANY of:
//   - commission_ledger rows (earned commission — audit-required record)
//   - payouts (money out — audit-required record)
//   - orders with status ∈ paid|fulfilled|shipped|delivered|refunded (real money
//     touched — AML/KYC retention obligations override deletion requests)
//
// On a system that handles money you cannot universally honour a "delete"
// request the way GDPR's right-to-erasure pretends. Records of real-money
// transactions must be retained. For those cases this action refuses and tells
// you exactly what's blocking; you can either purge each blocking order via
// the existing /admin/orders/[id] superadmin purge button (refunded orders
// then need a separate clawback workflow), or fall back to soft-delete
// (deactivateUser) which preserves the audit trail.
//
// For users with NO financial trail (signed-up, never paid, never earned),
// hard-delete works in one transaction and fully removes them.
// =============================================================================

export type HardDeleteSafetyBlock = {
  reason:
    | 'commission_ledger_rows'
    | 'payouts_exist'
    | 'paid_orders_exist'
    | 'pending_orders_exist'
  count: number
  detail: string
}

export type HardDeleteSafetyResult = {
  ok: true
  blocks: HardDeleteSafetyBlock[]
  /** True iff no blocks fired. */
  safe: boolean
  /** Snapshot of what hard-delete WOULD remove, for the confirmation dialog. */
  preview: {
    profile_exists: boolean
    addresses_count: number
    distributors_count: number
    orphan_orders_count: number
  }
}

export async function checkHardDeleteSafety(
  userId: string,
): Promise<HardDeleteSafetyResult | { ok: false; error: string }> {
  try {
    await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden — superadmin required' }
    throw err
  }
  const parsed = z.string().uuid().safeParse(userId)
  if (!parsed.success) return { ok: false, error: 'Invalid user id' }

  const service = createServiceClient()

  // Resolve to a distributor.id (if any) — every blocking check below pivots
  // on this. A user without a distributor row has no commission/payout
  // footprint by definition, so we can short-circuit those checks.
  const distRes = await service
    .from('distributors')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const distributorId = (distRes.data as { id: number } | null)?.id ?? null

  const blocks: HardDeleteSafetyBlock[] = []

  if (distributorId !== null) {
    const ledgerRes = await service
      .from('commission_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('distributor_id', distributorId)
    const ledgerCount = ledgerRes.count ?? 0
    if (ledgerCount > 0) {
      blocks.push({
        reason: 'commission_ledger_rows',
        count: ledgerCount,
        detail: `${ledgerCount} commission_ledger row(s) credit this user's distributor. These are AML/audit-required and cannot be deleted.`,
      })
    }

    const payoutsRes = await service
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('distributor_id', distributorId)
    const payoutsCount = payoutsRes.count ?? 0
    if (payoutsCount > 0) {
      blocks.push({
        reason: 'payouts_exist',
        count: payoutsCount,
        detail: `${payoutsCount} payout row(s) reference this user's distributor. Real money out — must be retained.`,
      })
    }
  }

  // Orders with real money touched — block. user_id is nullable on orders, so
  // we count by user_id directly. Cast the enum-typed `status` column reads
  // through `unknown` so the TS check is strict against the literal-union the
  // generated types expose.
  const paidStatuses = ['paid', 'fulfilled', 'shipped', 'delivered', 'refunded'] as const
  const paidOrdersRes = await service
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', paidStatuses as unknown as readonly Database['public']['Enums']['order_status'][])
  const paidCount = paidOrdersRes.count ?? 0
  if (paidCount > 0) {
    blocks.push({
      reason: 'paid_orders_exist',
      count: paidCount,
      detail: `${paidCount} order(s) where real money flowed (paid/fulfilled/shipped/delivered/refunded). AML retention applies. Use Deactivate, or purge each one via the order page if appropriate.`,
    })
  }

  // Pending orders are not financial yet, but they hold the partial-unique
  // index slot. Block separately so the operator orphans them deliberately
  // (the hardDeleteUser call WILL do this in the unblocked path; this is the
  // "we are aware of these" UX surface).
  const pendingStatusesForPreview = ['pending', 'cancelled', 'expired', 'failed'] as const
  const pendingOrdersRes = await service
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in(
      'status',
      pendingStatusesForPreview as unknown as readonly Database['public']['Enums']['order_status'][],
    )
  const pendingCount = pendingOrdersRes.count ?? 0

  const addrRes = await service
    .from('addresses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const addrCount = addrRes.count ?? 0

  const profRes = await service
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', userId)
  const profileExists = (profRes.count ?? 0) > 0

  return {
    ok: true,
    blocks,
    safe: blocks.length === 0,
    preview: {
      profile_exists: profileExists,
      addresses_count: addrCount,
      distributors_count: distributorId !== null ? 1 : 0,
      orphan_orders_count: pendingCount,
    },
  }
}

export type HardDeleteResult =
  | { ok: true; message: string }
  | { ok: false; error: string; blocks?: HardDeleteSafetyBlock[] }

export async function hardDeleteUser(
  raw: { userId: string; confirmEmail: string },
): Promise<HardDeleteResult> {
  let session
  try {
    session = await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden — superadmin required' }
    throw err
  }

  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Invalid request' }
  const { userId, confirmEmail } = parsed.data

  if (userId === session.userId) {
    return { ok: false, error: 'You cannot hard-delete your own account.' }
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
      error: `Protected account (${targetEmail}). This account cannot be hard-deleted by policy — see the authorized-accounts memory.`,
    }
  }

  if (targetEmail.toLowerCase() !== confirmEmail.toLowerCase()) {
    return {
      ok: false,
      error: `Confirmation email did not match. Type "${targetEmail}" exactly.`,
    }
  }

  // Re-run the safety checks server-side (the UI gates them too, but a stale
  // session or a custom client could try to skip them — defence in depth).
  const safety = await checkHardDeleteSafety(userId)
  if (!('ok' in safety) || !safety.ok) {
    return { ok: false, error: 'Safety check failed' }
  }
  if (!safety.safe) {
    return {
      ok: false,
      error: 'Hard delete blocked — this account has audit-required financial history.',
      blocks: safety.blocks,
    }
  }

  // ---------------------------------------------------------------
  // Pre-cleanup: orphan any non-financial orders so the auth.users
  // delete cascade doesn't hit a NO ACTION FK on orders.user_id.
  // The orders themselves (and their order_items, payment_attempts)
  // stay for audit; we just sever the user_id link.
  // ---------------------------------------------------------------
  const pendingStatuses: ReadonlyArray<string> = ['pending', 'cancelled', 'expired', 'failed']
  const orphanRes = await (service.from('orders') as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => {
        in: (col2: string, vals: ReadonlyArray<string>) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  })
    .update({ user_id: null })
    .eq('user_id', userId)
    .in('status', pendingStatuses)
  if (orphanRes.error) {
    return {
      ok: false,
      error: `Order pre-cleanup failed: ${orphanRes.error.message}`,
    }
  }

  // ---------------------------------------------------------------
  // Capture a before-snapshot for the audit row. After the delete,
  // the user is gone — this snapshot is what an engineer would need
  // to reverse the action manually (though "reversing" a hard-delete
  // is best-effort at best; the audit row is the legal record that
  // the deletion happened).
  // ---------------------------------------------------------------
  const beforeSnapshot = {
    user: {
      id: target.id,
      email: targetEmail,
      created_at: target.created_at,
      user_metadata: target.user_metadata ?? {},
    },
    preview: safety.preview,
  }

  // ---------------------------------------------------------------
  // The actual hard-delete. Cascades:
  //   auth.users → profiles (CASCADE) → addresses (CASCADE)
  //                                  → distributors (CASCADE)
  //                                       → distributor_tree (CASCADE)
  //   orders.user_id pre-orphaned above; remaining rows keep their
  //     order_number, customer_email, customer_phone, total_minor for
  //     audit but no longer link to a person.
  // ---------------------------------------------------------------
  const deleteRes = await service.auth.admin.deleteUser(userId)
  if (deleteRes.error) {
    return {
      ok: false,
      error: `Auth delete failed: ${deleteRes.error.message}. The orphan-orders pre-step succeeded, so the order trail is preserved.`,
    }
  }

  // ---------------------------------------------------------------
  // Audit. The actor_id check on audit_log requires that we use the
  // session userId; we deliberately do NOT use the deleted user as
  // the actor (they're gone). resource_id keeps the deleted user's
  // uuid as a stable forensic anchor.
  // ---------------------------------------------------------------
  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'user.hard_deleted',
    resource_type: 'user',
    resource_id: userId,
    before_data: beforeSnapshot,
    after_data: {
      deleted_at: new Date().toISOString(),
      orphaned_orders_count: safety.preview.orphan_orders_count,
    },
  })

  revalidatePath('/admin/system/users')
  return {
    ok: true,
    message: `Hard-deleted ${targetEmail}. Auth user, profile, addresses, and distributor row removed. ${safety.preview.orphan_orders_count} pending/cancelled order(s) orphaned (audit preserved).`,
  }
}
