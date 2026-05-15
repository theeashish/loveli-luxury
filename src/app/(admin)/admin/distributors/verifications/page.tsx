/**
 * Pending payout MSISDN verifications.
 *
 * Lists distributors whose `payout_msisdn_pending` is non-null. Each row
 * shows the current vs. proposed numbers, the submission timestamp, and
 * Approve / Reject buttons that hit the same Server Action with
 * different `decision` values.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { decideMsisdnChange } from './actions'

export const dynamic = 'force-dynamic'

type Pending = {
  id: number
  user_id: string
  sponsor_code: string
  payout_msisdn: string | null
  payout_msisdn_pending: string
  payout_msisdn_pending_at: string
}

type ProfileRow = { id: string; full_name: string; email: string }

export default async function VerificationsPage() {
  const service = createServiceClient()
  const r = await service
    .from('distributors')
    .select(
      'id, user_id, sponsor_code, payout_msisdn, payout_msisdn_pending, payout_msisdn_pending_at',
    )
    .not('payout_msisdn_pending', 'is', null)
    .order('payout_msisdn_pending_at', { ascending: false })
    .limit(200)
  const rows = (r.data ?? []) as Pending[]

  const userIds = Array.from(new Set(rows.map((x) => x.user_id)))
  const profilesRes = userIds.length
    ? await service
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)
    : { data: [] as ProfileRow[] }
  const profiles = (profilesRes.data ?? []) as ProfileRow[]

  return (
    <div className="max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          MSISDN verifications
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Distributors who have proposed a new payout M-Pesa number. Approve
          to make it active for payouts; reject to discard.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Distributor</th>
              <th className="px-4 py-3">Current</th>
              <th className="px-4 py-3">Proposed</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Decide</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                  No pending verifications.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const p = profiles.find((x) => x.id === row.user_id)
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {p?.full_name ?? row.sponsor_code}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {p?.email ?? `#${row.id}`} · {row.sponsor_code}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.payout_msisdn ?? (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.payout_msisdn_pending}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {new Date(row.payout_msisdn_pending_at).toLocaleString(
                        'en-KE',
                        { dateStyle: 'short', timeStyle: 'short' },
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <form action={decideMsisdnChange}>
                          <input
                            type="hidden"
                            name="distributorId"
                            value={row.id}
                          />
                          <input type="hidden" name="decision" value="reject" />
                          <button
                            type="submit"
                            className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-rose-700 hover:bg-rose-50"
                          >
                            Reject
                          </button>
                        </form>
                        <form action={decideMsisdnChange}>
                          <input
                            type="hidden"
                            name="distributorId"
                            value={row.id}
                          />
                          <input type="hidden" name="decision" value="approve" />
                          <button
                            type="submit"
                            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-white"
                          >
                            Approve
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
