/**
 * /admin/comp/partner-qualifications
 *
 * Phase 2a read-only view of the partner_qualifications materialized
 * view + each distributor's current tier. Per-distributor row:
 *   - sponsor code + active flag
 *   - current tier display name (Phase-1 bridge backfilled)
 *   - rolling 90-day verified revenue, unique buyers, paid orders,
 *     retention score
 *
 * The "Recompute now" button refreshes the materialized view. The
 * monthly close cron will also refresh automatically once Phase 2b
 * ships the schedule.
 */

import { AdminPageHeader } from '@/components/admin/forms'
import { formatKes } from '@/lib/money'
import { loadPartnerQualificationOverview } from '@/lib/partners/qualification'
import { RefreshButton } from './RefreshButton'

export const metadata = {
  title: 'Partner qualifications',
  robots: { index: false },
}
export const dynamic = 'force-dynamic'

export default async function PartnerQualificationsAdminPage() {
  const rows = await loadPartnerQualificationOverview()

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        eyebrow="Comp plan"
        title="Partner qualifications"
        subtitle="Rolling 90-day metrics for every distributor, paired with their current tier. Used by the engine-v2 evaluator (Phase 2b) and the quarterly retention bonus review."
      />

      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-600">
          {rows.length} {rows.length === 1 ? 'partner' : 'partners'} on file.
          Metrics computed by the partner_qualifications materialized view
          (migration 023).
        </p>
        <RefreshButton />
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Current tier</th>
              <th className="px-4 py-3 text-right">90d revenue</th>
              <th className="px-4 py-3 text-right">90d buyers</th>
              <th className="px-4 py-3 text-right">90d orders</th>
              <th className="px-4 py-3 text-right">Retention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No distributor rows yet. Sign up a distributor to see qualifications populate.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.distributor_id}>
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-neutral-900">
                      {r.sponsor_code}
                    </p>
                    {!r.is_active ? (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-rose-700">
                        Inactive
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-neutral-900">
                    {r.current_tier_display_name ?? (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-900">
                    {formatKes(r.verified_revenue_90d_minor)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.unique_buyers_90d}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.paid_orders_90d}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(r.retention_score_90d * 100).toFixed(0)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
