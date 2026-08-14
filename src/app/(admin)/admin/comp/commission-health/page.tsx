/**
 * /admin/comp/commission-health
 *
 * Comp-plan integrity dashboard: orders that are paid + commissionable but
 * have NO commission rows, with a one-click backfill. The daily cron
 * /api/cron/commission-reconcile runs the same logic automatically.
 *
 * (The v1-vs-v2 dry-run section was removed in migration 034 when the v2
 * 4-tier scaffolding was dropped.)
 */

import { createServiceClient } from '@/lib/supabase/service'
import { findOrdersMissingCommission } from '@/lib/mlm/commission-reconcile'
import { runReconcileNow } from './actions'

export const metadata = { title: 'Commission check', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CommissionHealthPage() {
  const service = createServiceClient()
  const missing = await findOrdersMissingCommission(service)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-eyebrow text-neutral-500">Commissions</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Commission check
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Finds paid orders that should have a commission but do not. The daily check normally fixes them; use this page when you want to check now.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Orders without commission</h2>
          <form action={runReconcileNow}>
            <button className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
              Add missing commission
            </button>
          </form>
        </div>
        {missing.length === 0 ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-sm text-emerald-900">
            Every paid order that should earn commission has one. Nothing needs fixing.
          </div>
        ) : (
          <ul className="space-y-2">
            {missing.map((o) => (
              <li
                key={o.orderId}
                className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
              >
                <strong>{o.orderNumber}</strong> (order #{o.orderId}) — {o.kind}, {o.status} —
                no commission rows.
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
