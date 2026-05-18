'use server'

/**
 * Refresh the partner_qualifications materialized view.
 *
 * Pure read-side maintenance: recomputes the rolling-90-day metrics
 * snapshot for every distributor. Locked to admin role. Wraps the
 * refresh_partner_qualifications RPC from migration 024.
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/roles'
import { refreshPartnerQualifications } from '@/lib/partners/qualification'
import { createServiceClient } from '@/lib/supabase/service'

export async function refreshPartnerQualificationsAction(): Promise<
  { ok: true; rowCount: number } | { error: string }
> {
  const session = await requireAdmin()

  let rowCount: number
  try {
    rowCount = await refreshPartnerQualifications()
  } catch (e) {
    return { error: (e as Error).message }
  }

  const service = createServiceClient()
  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'partner_qualifications.refreshed',
    resource_type: 'partner_qualifications',
    resource_id: 'materialized_view',
    after_data: { row_count: rowCount, refreshed_at: new Date().toISOString() },
  })

  revalidatePath('/admin/comp/partner-qualifications')
  return { ok: true, rowCount }
}
