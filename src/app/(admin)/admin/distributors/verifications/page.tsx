import { createServiceClient } from '@/lib/supabase/service'
import { decideKyc, decideMsisdnChange } from './actions'

export const dynamic = 'force-dynamic'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  national_id: string | null
}

type PendingMsisdn = {
  id: number
  user_id: string
  sponsor_code: string
  payout_msisdn: string | null
  payout_msisdn_pending: string
  payout_msisdn_pending_at: string
}

type PendingKyc = {
  id: number
  user_id: string
  sponsor_code: string
  is_active: boolean
  starter_paid_at: string | null
  kyc_status: string | null
  kyc_approved_at: string | null
  payout_msisdn: string | null
  payout_msisdn_verified_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return 'Not available'
  return new Date(value).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function VerificationQueuePage() {
  const service = createServiceClient()
  const [msisdnRes, kycRes] = await Promise.all([
    service
      .from('distributors')
      .select('id, user_id, sponsor_code, payout_msisdn, payout_msisdn_pending, payout_msisdn_pending_at')
      .not('payout_msisdn_pending', 'is', null)
      .order('payout_msisdn_pending_at', { ascending: true }),
    service
      .from('distributors')
      .select('id, user_id, sponsor_code, is_active, starter_paid_at, kyc_status, kyc_approved_at, payout_msisdn, payout_msisdn_verified_at')
      .eq('kyc_status', 'pending')
      .order('id', { ascending: true }),
  ])
  if (msisdnRes.error) throw new Error(msisdnRes.error.message)
  if (kycRes.error) throw new Error(kycRes.error.message)
  const msisdnRows = (msisdnRes.data ?? []) as PendingMsisdn[]
  const kycRows = (kycRes.data ?? []) as PendingKyc[]
  const userIds = [...new Set([...msisdnRows, ...kycRows].map((row) => row.user_id))]
  const profilesRes = userIds.length
    ? await service.from('profiles').select('id, email, full_name, national_id').in('id', userIds)
    : { data: [], error: null }
  if (profilesRes.error) throw new Error(profilesRes.error.message)
  const profiles = new Map(((profilesRes.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <p className="text-eyebrow text-neutral-500">People / verification</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">KYC and phone review</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-500">
          Review phone verification first. Government ID is shown only as an on-file signal here; keep the full document out of routine screens and request it only for a first payout or a risk flag.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-lg font-semibold">Pending partner KYC ({kycRows.length})</h2>
          <p className="mt-1 text-sm text-neutral-500">Approve only when the partner's phone number is verified. Approval does not activate the partner until the welcome-package stock purchase is paid.</p>
        </div>
        {kycRows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-neutral-500">No pending KYC reviews.</p>
        ) : (
          <div className="divide-y divide-neutral-200">
            {kycRows.map((row) => {
              const profile = profiles.get(row.user_id)
              const phoneVerified = Boolean(row.payout_msisdn_verified_at)
              return (
                <div key={row.id} className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium">{profile?.full_name || profile?.email || `Partner #${row.id}`}</p>
                    <p className="mt-1 text-xs text-neutral-500">{profile?.email ?? row.user_id} | Sponsor {row.sponsor_code}</p>
                    <dl className="mt-4 grid gap-3 text-xs text-neutral-600 sm:grid-cols-4">
                      <div><dt className="text-neutral-400">Phone</dt><dd className="font-mono">{row.payout_msisdn ?? 'Not supplied'}</dd></div>
                      <div><dt className="text-neutral-400">Phone status</dt><dd>{phoneVerified ? 'Verified' : 'Not verified'}</dd></div>
                      <div><dt className="text-neutral-400">Government ID</dt><dd>{profile?.national_id ? 'On file' : 'Not on file'}</dd></div>
                      <div><dt className="text-neutral-400">Partner state</dt><dd>{row.is_active && row.starter_paid_at ? 'Active' : 'Awaiting stock purchase'}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs text-neutral-400">Phone verified: {formatDate(row.payout_msisdn_verified_at)}. ID details remain masked in the queue.</p>
                  </div>
                  <div className="flex items-start justify-end gap-2">
                    {phoneVerified ? (
                      <form action={decideKyc}>
                        <input type="hidden" name="distributorId" value={row.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white">Approve</button>
                      </form>
                    ) : null}
                    <form action={decideKyc}>
                      <input type="hidden" name="distributorId" value={row.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button type="submit" className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-rose-700">Reject</button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-lg font-semibold">Pending payout-number changes ({msisdnRows.length})</h2>
          <p className="mt-1 text-sm text-neutral-500">Approve a new M-Pesa number only after the normal verification evidence is present.</p>
        </div>
        {msisdnRows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-neutral-500">No pending payout-number changes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-[0.15em] text-neutral-500">
                <tr><th className="px-6 py-3">Partner</th><th className="px-6 py-3">Current</th><th className="px-6 py-3">Proposed</th><th className="px-6 py-3">Submitted</th><th className="px-6 py-3 text-right">Decision</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {msisdnRows.map((row) => {
                  const profile = profiles.get(row.user_id)
                  return (
                    <tr key={row.id}>
                      <td className="px-6 py-4"><p className="font-medium">{profile?.email ?? `Partner #${row.id}`}</p><p className="text-xs text-neutral-500">{row.sponsor_code}</p></td>
                      <td className="px-6 py-4 font-mono text-xs">{row.payout_msisdn ?? 'Not set'}</td>
                      <td className="px-6 py-4 font-mono text-xs">{row.payout_msisdn_pending}</td>
                      <td className="px-6 py-4 text-xs text-neutral-500">{formatDate(row.payout_msisdn_pending_at)}</td>
                      <td className="px-6 py-4"><div className="flex justify-end gap-2"><form action={decideMsisdnChange}><input type="hidden" name="distributorId" value={row.id} /><input type="hidden" name="decision" value="approve" /><button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-white">Approve</button></form><form action={decideMsisdnChange}><input type="hidden" name="distributorId" value={row.id} /><input type="hidden" name="decision" value="reject" /><button type="submit" className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-rose-700">Reject</button></form></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
