'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

const updateSchema = z.object({
  packageCode: z.string().min(1).max(10),
  joiningFeeKes: z
    .number()
    .int()
    .min(0)
    .max(1_000_000),
})

/**
 * Versioned update of a starter package's joining fee. Closes the
 * currently active row (effective_until = NOW()) and inserts a fresh
 * row with the new fee. Preserves full history per the
 * effective_from/effective_until pattern used elsewhere in config_*.
 */
export async function updateStarterJoiningFee(input: {
  packageCode: string
  joiningFeeKes: number
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireAdmin()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }

  const service = createServiceClient()
  const newFeeMinor = parsed.data.joiningFeeKes * 100

  // 1. Find the currently active row for this package_code
  const activeRes = await service
    .from('config_starter_packages')
    .select('id, bundle_id, joining_fee_minor')
    .eq('package_code', parsed.data.packageCode)
    .is('effective_until', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeRes.error) {
    return { error: `Lookup failed: ${activeRes.error.message}` }
  }
  if (!activeRes.data) {
    return {
      error: `No active starter package config for code '${parsed.data.packageCode}'.`,
    }
  }

  const current = activeRes.data as {
    id: number
    bundle_id: number
    joining_fee_minor: string | number
  }

  // Short-circuit: same value? No-op.
  if (Number(current.joining_fee_minor) === newFeeMinor) {
    return { ok: true }
  }

  // 2. Close the active row
  const closeRes = await service
    .from('config_starter_packages')
    .update({ effective_until: new Date().toISOString() })
    .eq('id', current.id)
  if (closeRes.error) {
    return { error: `Failed to close old row: ${closeRes.error.message}` }
  }

  // 3. Insert the new row
  const insertRes = await service
    .from('config_starter_packages')
    .insert({
      package_code: parsed.data.packageCode,
      bundle_id: current.bundle_id,
      joining_fee_minor: newFeeMinor,
      created_by: session.userId,
    })
    .select('id')
    .single()
  if (insertRes.error || !insertRes.data) {
    // Best-effort rollback of the close
    await service
      .from('config_starter_packages')
      .update({ effective_until: null })
      .eq('id', current.id)
    return {
      error: `Failed to insert new row: ${insertRes.error?.message ?? 'unknown'}`,
    }
  }

  // 4. Audit
  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'config.starter_joining_fee_updated',
    resource_type: 'config_starter_packages',
    resource_id: String(insertRes.data.id),
    before_data: {
      package_code: parsed.data.packageCode,
      joining_fee_minor: Number(current.joining_fee_minor),
    },
    after_data: {
      package_code: parsed.data.packageCode,
      joining_fee_minor: newFeeMinor,
    },
  })

  revalidatePath('/admin/comp/starter-packages')
  revalidatePath('/partners/signup')
  return { ok: true }
}
