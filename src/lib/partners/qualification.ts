/**
 * Server-side helpers for the partner_tiers + partner_qualifications
 * data introduced in migrations 023 + 024. Server-only.
 *
 * The materialized view is locked down to service_role per migration
 * 023; every read here uses `createServiceClient`. Admin pages gate
 * access at the page-handler layer via `requireAdmin`.
 *
 * Phase 2a usage: the /admin/comp/tiers and /admin/comp/partner-
 * qualifications pages read all four tiers + per-partner qualification
 * rows and pass them through {@link evaluatePartnerTier} for display.
 *
 * Phase 2b: the compensation engine v2 reads rates + override caps from
 * `loadActivePartnerTiers` to compute commission allocation.
 */

import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { PartnerTier, PartnerQualification } from './types'

/**
 * Load the 4 active partner tiers (effective_until IS NULL), ordered
 * by tier_position ascending. Throws if no rows are returned — migration
 * 023 seeds 4 rows so an empty result means the schema isn't applied.
 */
export async function loadActivePartnerTiers(): Promise<PartnerTier[]> {
  const service = createServiceClient()
  // TODO(types): regenerate database.ts post-023; cast through unknown
  // until then.
  const res = (await (service.from('partner_tiers' as never) as unknown as {
    select: (cols: string) => {
      is: (col: string, val: unknown) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: PartnerTier[] | null
          error: { message: string } | null
        }>
      }
    }
  })
    .select(
      'id, tier_position, tier_code, display_name, direct_rate_basis_points, override_rate_basis_points, can_refer_tier_max, qualification_rules, effective_from, effective_until, created_at',
    )
    .is('effective_until', null)
    .order('tier_position', { ascending: true }))
  if (res.error) {
    throw new Error(`loadActivePartnerTiers failed: ${res.error.message}`)
  }
  const tiers = res.data ?? []
  if (tiers.length === 0) {
    throw new Error(
      'No active partner tiers configured. Apply migration 023 in Supabase.',
    )
  }
  return tiers
}

/**
 * Load the latest qualification row for a single distributor. Returns
 * null if the materialized view has no row for them (typical for newly
 * inserted distributors before the next refresh).
 */
export async function loadPartnerQualification(
  distributorId: number,
): Promise<PartnerQualification | null> {
  const service = createServiceClient()
  const res = (await service.rpc('compute_partner_qualifications' as never, {
    p_distributor_id: distributorId,
  } as never)) as unknown as {
    data: PartnerQualification | null
    error: { message: string } | null
  }
  if (res.error) {
    throw new Error(`loadPartnerQualification failed: ${res.error.message}`)
  }
  return res.data ?? null
}

/**
 * Trigger a CONCURRENT refresh of the partner_qualifications
 * materialized view. Returns the new row count. Used by the admin
 * "Recompute now" button on /admin/comp/partner-qualifications.
 */
export async function refreshPartnerQualifications(): Promise<number> {
  const service = createServiceClient()
  const res = (await service.rpc('refresh_partner_qualifications' as never)) as unknown as {
    data: number | string | null
    error: { message: string } | null
  }
  if (res.error) {
    throw new Error(
      `refreshPartnerQualifications failed: ${res.error.message}`,
    )
  }
  return Number(res.data ?? 0)
}

/**
 * Page-friendly bulk read for the admin partner-qualifications screen.
 * Joins distributors + their tier + their qualification row in one shot.
 * Returns rows ordered by `verified_revenue_90d_minor` desc.
 */
export async function loadPartnerQualificationOverview(): Promise<
  Array<{
    distributor_id: number
    sponsor_code: string
    is_active: boolean
    current_tier_id: number | null
    current_tier_display_name: string | null
    verified_revenue_90d_minor: bigint
    unique_buyers_90d: number
    paid_orders_90d: number
    retention_score_90d: number
  }>
> {
  const service = createServiceClient()

  // We have to read in 3 chunks because the materialized view has no FK
  // relationships PostgREST can join through. Cheap on Phase-2 data
  // volumes (tens of distributors).
  const tiers = await loadActivePartnerTiers()
  const tierById = new Map(tiers.map((t) => [t.id, t]))

  const distRes = (await service
    .from('distributors')
    .select('id, sponsor_code, is_active, current_tier_id')) as unknown as {
    data: Array<{
      id: number
      sponsor_code: string
      is_active: boolean
      current_tier_id: number | null
    }> | null
    error: { message: string } | null
  }
  if (distRes.error) {
    throw new Error(`Distributors lookup failed: ${distRes.error.message}`)
  }
  const distributors = distRes.data ?? []

  // partner_qualifications is locked to service_role — direct SELECT.
  const qualRes = (await (service.from('partner_qualifications' as never) as unknown as {
    select: (cols: string) => Promise<{
      data: Array<{
        distributor_id: number
        verified_revenue_90d_minor: string | number
        unique_buyers_90d: number
        paid_orders_90d: number
        retention_score_90d: number
      }> | null
      error: { message: string } | null
    }>
  })
    .select(
      'distributor_id, verified_revenue_90d_minor, unique_buyers_90d, paid_orders_90d, retention_score_90d',
    ))
  if (qualRes.error) {
    throw new Error(
      `partner_qualifications lookup failed: ${qualRes.error.message}. ` +
        `Did migration 023 run and the view get its first refresh?`,
    )
  }
  const qualByDist = new Map(
    (qualRes.data ?? []).map((q) => [q.distributor_id, q]),
  )

  return distributors
    .map((d) => {
      const q = qualByDist.get(d.id)
      const tier = d.current_tier_id !== null ? tierById.get(d.current_tier_id) : null
      return {
        distributor_id: d.id,
        sponsor_code: d.sponsor_code,
        is_active: d.is_active,
        current_tier_id: d.current_tier_id,
        current_tier_display_name: tier?.display_name ?? null,
        verified_revenue_90d_minor: BigInt(q?.verified_revenue_90d_minor ?? 0),
        unique_buyers_90d: q?.unique_buyers_90d ?? 0,
        paid_orders_90d: q?.paid_orders_90d ?? 0,
        retention_score_90d: q?.retention_score_90d ?? 0,
      }
    })
    .sort(
      (a, b) =>
        // bigint sort — both fits in Number for tens-of-thousands of cents.
        Number(b.verified_revenue_90d_minor) -
        Number(a.verified_revenue_90d_minor),
    )
}
