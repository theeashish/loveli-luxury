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

export const metadata = { title: 'Commission health', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function CommissionHealthPage() {
  const service = createServiceClient()
  const missing = await findOrdersMissingCommission(service)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-eyebrow text-neutral-500">Comp</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Commission health
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Detects paid, commissionable orders that have no commission rows (e.g. a
          webhook ledger-write that failed non-fatally) and backfills them. The daily
          cron <code>/api/cron/commission-reconcile</code> runs this automatically;
          this is the manual view + trigger.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Orders missing commissions</h2>
          <form action={runReconcileNow}>
            <button className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
              Backfill now
            </button>
          </form>
        </div>
        {missing.length === 0 ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-sm text-emerald-900">
            All paid, commissionable orders have their commissions. Nothing to backfill.
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
