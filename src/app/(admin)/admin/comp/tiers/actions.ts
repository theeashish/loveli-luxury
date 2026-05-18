'use server'

/**
 * Versioned updates to a partner_tiers row.
 *
 * Same effective_from/effective_until pattern as config_starter_packages
 * — closing the active row + inserting a fresh row preserves the full
 * history for audit. Read-only fields (tier_position, tier_code,
 * display_name) cannot be changed here; only numeric thresholds, rates
 * and the qualification rules JSONB.
 *
 * Phase 2a writes only the read-only display + this form's edits. The
 * compensation engine does NOT read partner_tiers yet (v1_rank still
 * runs); Phase 2b flips that.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import type { QualificationRules } from '@/lib/partners/types'

const rulesSchema: z.ZodType<QualificationRules> = z.object({
  requires_any: z
    .array(z.enum(['verified_content_creator', 'verified_customer']))
    .optional(),
  min_90d_retail_minor: z.number().int().nonnegative().optional(),
  min_retention_score: z.number().min(0).max(1).optional(),
  min_unique_buyers_90d: z.number().int().nonnegative().optional(),
  min_90d_post_count: z.number().int().nonnegative().optional(),
  quarterly_review_required: z.boolean().optional(),
  brand_compliance_required: z.boolean().optional(),
})

const updateSchema = z.object({
  tierPosition: z.coerce.number().int().min(1).max(4),
  directRateBasisPoints: z.coerce.number().int().min(0).max(10000),
  overrideRateBasisPoints: z.coerce.number().int().min(0).max(10000),
  canReferTierMax: z.coerce.number().int().min(0).max(4),
  qualificationRules: rulesSchema,
})

export async function updatePartnerTierRules(
  input: z.infer<typeof updateSchema>,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireAdmin()
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const data = parsed.data
  const service = createServiceClient()

  // 1. Load currently active row for this tier_position.
  //    TODO(types): regenerate src/types/database.ts post-023 to drop these casts.
  const activeRes = (await (service.from('partner_tiers' as never) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        is: (col: string, val: unknown) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{
                data: {
                  id: number
                  tier_code: string
                  display_name: string
                  direct_rate_basis_points: number
                  override_rate_basis_points: number
                  can_refer_tier_max: number
                  qualification_rules: QualificationRules
                } | null
                error: { message: string } | null
              }>
            }
          }
        }
      }
    }
  })
    .select(
      'id, tier_code, display_name, direct_rate_basis_points, override_rate_basis_points, can_refer_tier_max, qualification_rules',
    )
    .eq('tier_position', data.tierPosition)
    .is('effective_until', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle())
  if (activeRes.error) {
    return { error: `Lookup failed: ${activeRes.error.message}` }
  }
  if (!activeRes.data) {
    return {
      error: `No active partner_tiers row for tier_position ${data.tierPosition}.`,
    }
  }
  const current = activeRes.data

  // 2. Short-circuit if nothing changed.
  const sameRates =
    current.direct_rate_basis_points === data.directRateBasisPoints &&
    current.override_rate_basis_points === data.overrideRateBasisPoints &&
    current.can_refer_tier_max === data.canReferTierMax
  const sameRules =
    JSON.stringify(current.qualification_rules ?? {}) ===
    JSON.stringify(data.qualificationRules)
  if (sameRates && sameRules) {
    return { ok: true }
  }

  // 3. Close the active row.
  const closeRes = await (service.from('partner_tiers' as never) as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: unknown) => Promise<{
        error: { message: string } | null
      }>
    }
  })
    .update({ effective_until: new Date().toISOString() })
    .eq('id', current.id)
  if (closeRes.error) {
    return { error: `Failed to close prior row: ${closeRes.error.message}` }
  }

  // 4. Insert the new row.
  const insertRes = await (service.from('partner_tiers' as never) as unknown as {
    insert: (v: Record<string, unknown>) => {
      select: (cols: string) => {
        single: () => Promise<{
          data: { id: number } | null
          error: { message: string } | null
        }>
      }
    }
  })
    .insert({
      tier_position: data.tierPosition,
      tier_code: current.tier_code,
      display_name: current.display_name,
      direct_rate_basis_points: data.directRateBasisPoints,
      override_rate_basis_points: data.overrideRateBasisPoints,
      can_refer_tier_max: data.canReferTierMax,
      qualification_rules: data.qualificationRules,
    })
    .select('id')
    .single()
  if (insertRes.error || !insertRes.data) {
    // Best-effort rollback so we don't strand the position without an
    // active row.
    await (service.from('partner_tiers' as never) as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: unknown) => Promise<unknown>
      }
    })
      .update({ effective_until: null })
      .eq('id', current.id)
    return {
      error: `Insert failed: ${insertRes.error?.message ?? 'unknown'}`,
    }
  }

  // 5. Audit. Cast through `from(... as never)` to bypass the generated
  //    Json typing — QualificationRules has optional fields that the
  //    Json type can't accept directly.
  await (service.from('audit_log' as never) as unknown as {
    insert: (v: Record<string, unknown>) => Promise<{
      error: { message: string } | null
    }>
  })
    .insert({
      actor_id: session.userId,
      action: 'config.partner_tier_updated',
      resource_type: 'partner_tiers',
      resource_id: String(insertRes.data.id),
      before_data: {
        tier_position: data.tierPosition,
        direct_rate_basis_points: current.direct_rate_basis_points,
        override_rate_basis_points: current.override_rate_basis_points,
        can_refer_tier_max: current.can_refer_tier_max,
        qualification_rules: current.qualification_rules,
      },
      after_data: {
        tier_position: data.tierPosition,
        direct_rate_basis_points: data.directRateBasisPoints,
        override_rate_basis_points: data.overrideRateBasisPoints,
        can_refer_tier_max: data.canReferTierMax,
        qualification_rules: data.qualificationRules,
      },
    })

  revalidatePath('/admin/comp/tiers')
  return { ok: true }
}
