'use server'

/**
 * Superadmin-only user management actions.
 *
 * Per the canonical brand brief and the authorized-accounts memory, four
 * accounts are protected from deactivation regardless of who tries it:
 *   - capernstone@gmail.com (owner Ashish, site account)
 *   - ashishke79@gmail.com  (owner Ashish, founding distributor)
 *   - ashirumaabala1@gmail.com (dev/test, kept reversible)
 *   - rymiruzz@gmail.com    (Ruth Karimi â€” the CLIENT)
 *
 * Two actions are exposed:
 *
 *   deactivateUser  â€” reversible. Revokes all roles, bans the user in
 *                     Supabase Auth for ~100 years, anonymises the email so
 *                     it can be re-registered, and inactivates any distributor
 *                     row owned by this user (fix shipped 2026-05-30 â€” see
 *                     migration 044). The financial audit trail (commissions,
 *                     payouts, paid orders, ledger) is preserved untouched.
 *                     This is the right choice for any user with real-money
 *                     history (AML/KYC retention obligations).
 *
 *   hardDeleteUser  â€” NOT reversible. Removes the auth identity, profile,
 *                     addresses, and eligible distributor identity. Financial
 *                     order rows are retained for accounting, but their user
 *                     link, customer email, phone, and shipping link are
 *                     redacted before deletion. Commission/payout history can
 *                     still block deletion when the distributor identity must
 *                     remain.
 *
 *   checkHardDeleteSafety â€” pre-flight check that returns what would be
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
  /** Typed confirmation â€” must match the user's email exactly. */
  confirmEmail: z.string().min(1),
})

export async function deactivateUser(
  raw: { userId: string; confirmEmail: string },
): Promise<DeactivateResult> {
  let session
  try {
    session = await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden â€” superadmin required' }
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
      error: `Protected account (${targetEmail}). This account cannot be deactivated by policy â€” see the authorized-accounts memory.`,
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
  // distributor row stays ACTIVE â€” meaning the commission engine keeps
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
      error: `Distributor deactivation failed: ${distRes.error.message}. Roles were revoked but distributor row(s) are still ACTIVE â€” re-run to complete.`,
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
      error: `Auth update failed: ${banRes.error.message}. Roles were revoked but the account is not yet banned â€” re-run to complete.`,
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
// True deletion removes the auth identity, profile, addresses, and eligible
// distributor identity. Every linked order is retained as an accounting row,
// but its direct identity fields are redacted before the profile is deleted.
// Commission or payout rows can still block deletion when the distributor
// identity must remain for financial reconciliation.
// =============================================================================

export type HardDeleteSafetyBlock = {
  reason:
    | 'commission_ledger_rows'
    | 'payouts_exist'
    | 'distributor_dependencies_exist'
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
    financial_orders_count: number
  }
}

export async function checkHardDeleteSafety(
  userId: string,
): Promise<HardDeleteSafetyResult | { ok: false; error: string }> {
  try {
    await requireSuperadmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden â€” superadmin required' }
    throw err
  }
  const parsed = z.string().uuid().safeParse(userId)
  if (!parsed.success) return { ok: false, error: 'Invalid user id' }

  const service = createServiceClient()

  // Resolve to a distributor.id (if any) â€” every blocking check below pivots
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
    // Every foreign key to a distributor must be accounted for before identity
    // deletion begins. These records either represent money, compensation,
    // verification, a downline relationship, or someone else's sponsored order.
    const [
      recipientLedgerRes,
      sourceLedgerRes,
      payoutsRes,
      salariesRes,
      bonusesRes,
      snapshotsRes,
      adjustmentsRes,
      verificationsRes,
      downlineRes,
      sponsoredOrdersRes,
    ] = await Promise.all([
      service
        .from('commission_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('commission_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('source_distributor_id', distributorId),
      service
        .from('payouts')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('monthly_salaries')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('rank_up_bonuses')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('gsv_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('manual_ledger_adjustments')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('msisdn_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId),
      service
        .from('distributors')
        .select('id', { count: 'exact', head: true })
        .eq('sponsor_id', distributorId),
      service
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('sponsor_distributor_id', distributorId),
    ])

    const ledgerCount = (recipientLedgerRes.count ?? 0) + (sourceLedgerRes.count ?? 0)
    if (ledgerCount > 0) {
      blocks.push({
        reason: 'commission_ledger_rows',
        count: ledgerCount,
        detail: `${ledgerCount} commission ledger row(s) reference this distributor. These are audit-required and cannot be deleted.`,
      })
    }

    const payoutsCount = payoutsRes.count ?? 0
    if (payoutsCount > 0) {
      blocks.push({
        reason: 'payouts_exist',
        count: payoutsCount,
        detail: `${payoutsCount} payout row(s) reference this distributor. Real money out â€” the distributor identity must be retained.`,
      })
    }

    const dependencies = [
      ['monthly salary', salariesRes.count ?? 0],
      ['rank bonus', bonusesRes.count ?? 0],
      ['GSV snapshot', snapshotsRes.count ?? 0],
      ['manual ledger adjustment', adjustmentsRes.count ?? 0],
      ['M-Pesa verification', verificationsRes.count ?? 0],
      ['downline distributor', downlineRes.count ?? 0],
      ['sponsored order', sponsoredOrdersRes.count ?? 0],
    ] as const
    const activeDependencies = dependencies.filter(([, count]) => count > 0)
    if (activeDependencies.length > 0) {
      const total = activeDependencies.reduce((sum, [, count]) => sum + count, 0)
      const summary = activeDependencies.map(([label, count]) => `${count} ${label}`).join(', ')
      blocks.push({
        reason: 'distributor_dependencies_exist',
        count: total,
        detail: `Distributor dependency block: ${summary}. Deactivate this account instead; deleting it would break financial, verification, sponsor, or downline records.`,
      })
    }
  }

  // Count financial orders for the preview. They remain as accounting rows,
  // but their direct identity fields are redacted during deletion.
  const paidStatuses = ['paid', 'fulfilled', 'shipped', 'delivered', 'refunded'] as const
  const paidOrdersRes = await service
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', paidStatuses as unknown as readonly Database['public']['Enums']['order_status'][])
  const paidCount = paidOrdersRes.count ?? 0

  // Pending/failed orders are included in the preview and detached during
  // deletion. They are not financial blockers.
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
      financial_orders_count: paidCount
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
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden â€” superadmin required' }
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
      error: `Protected account (${targetEmail}). This account cannot be hard-deleted by policy â€” see the authorized-accounts memory.`,
    }
  }

  if (targetEmail.toLowerCase() !== confirmEmail.toLowerCase()) {
    return {
      ok: false,
      error: `Confirmation email did not match. Type "${targetEmail}" exactly.`,
    }
  }

  // Re-run the safety checks server-side (the UI gates them too, but a stale
  // session or a custom client could try to skip them â€” defence in depth).
  const safety = await checkHardDeleteSafety(userId)
  if (!('ok' in safety) || !safety.ok) {
    return { ok: false, error: 'Safety check failed' }
  }
  if (!safety.safe) {
    return {
      ok: false,
      error: 'Hard delete blocked — this distributor has financial, verification, sponsor, or downline records that must remain intact.',
      blocks: safety.blocks,
    }
  }

  // ---------------------------------------------------------------
  // Pre-cleanup: clear nullable profile references, then redact and detach
  // every linked order before auth.users is deleted. Financial order rows
  // remain for accounting; profile-owned addresses are deleted by cascade.
  // ---------------------------------------------------------------
  const nullableProfileReferences = [
    ['user_roles', 'granted_by'],
    ['config_commission_rates', 'created_by'],
    ['config_ranks', 'created_by'],
    ['config_salary_tiers', 'created_by'],
    ['config_starter_packages', 'created_by'],
    ['audit_log', 'actor_id'],
    ['manual_ledger_adjustments', 'actor_id'],
    ['payouts', 'approved_by'],
    ['homepage_reviews', 'created_by'],
    ['press_features', 'created_by'],
    ['payments', 'user_id'],
  ] as const
  for (const [table, column] of nullableProfileReferences) {
    const clearResult = await (service.from(table) as unknown as {
      update: (values: Record<string, unknown>) => {
        eq: (field: string, value: unknown) => Promise<{ error: { message: string } | null }>
      }
    })
      .update({ [column]: null })
      .eq(column, userId)
    if (clearResult.error) {
      return {
        ok: false,
        error: `Profile-reference cleanup failed for ${table}.${column}: ${clearResult.error.message}`,
      }
    }
  }

  const deletedEmail = `deleted-${userId}@deleted.local`
  const orderSnapshotRes = await service
    .from('orders')
    .select('id, user_id, customer_email, customer_phone, shipping_address_id')
    .eq('user_id', userId)
  if (orderSnapshotRes.error) {
    return {
      ok: false,
      error: `Order pre-cleanup read failed: ${orderSnapshotRes.error.message}`,
    }
  }
  const orderSnapshots = orderSnapshotRes.data ?? []
  const detachOrdersRes = await service
    .from('orders')
    .update({
      user_id: null,
      customer_email: deletedEmail,
      customer_phone: null,
      shipping_address_id: null,
    })
    .eq('user_id', userId)
  if (detachOrdersRes.error) {
    return {
      ok: false,
      error: `Order pre-cleanup failed: ${detachOrdersRes.error.message}`,
    }
  }

  // ---------------------------------------------------------------
  // Capture a before-snapshot for the audit row. After the delete,
  // the user is gone â€” this snapshot is what an engineer would need
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
  //   auth.users â†’ profiles (CASCADE) â†’ addresses (CASCADE)
  //                                  â†’ distributors (CASCADE)
  //                                       â†’ distributor_tree (CASCADE)
  //   orders.user_id pre-orphaned above; remaining rows keep their
  //     order_number, customer_email, customer_phone, total_minor for
  //     audit but no longer link to a person.
  // ---------------------------------------------------------------
  const deleteRes = await service.auth.admin.deleteUser(userId)
  if (deleteRes.error) {
    const restoreResults = await Promise.all(
      orderSnapshots.map((order) =>
        service
          .from('orders')
          .update({
            user_id: order.user_id,
            customer_email: order.customer_email,
            customer_phone: order.customer_phone,
            shipping_address_id: order.shipping_address_id,
          })
          .eq('id', order.id),
      ),
    )
    const restoreError = restoreResults.find((result) => result.error)?.error
    return {
      ok: false,
      error: restoreError
        ? `Auth delete failed: ${deleteRes.error.message}. Order identity restoration also failed: ${restoreError.message}`
        : `Auth delete failed: ${deleteRes.error.message}. Order identity fields were restored.`,
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
      detached_orders_count: orderSnapshots.length,
      redacted_financial_orders_count: safety.preview.financial_orders_count,
    },
  })

  revalidatePath('/admin/system/users')
  return {
    ok: true,
    message: `Permanently deleted ${targetEmail}. The auth identity, profile, addresses, and eligible distributor identity were removed. ${orderSnapshots.length} linked order(s) were retained for accounting with identity fields redacted.`,
  }
}
