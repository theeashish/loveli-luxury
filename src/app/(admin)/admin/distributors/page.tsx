/**
 * /admin/distributors — searchable list of every distributor.
 *
 * Search matches sponsor_code (exact, case-insensitive), full_name (ILIKE),
 * email (ILIKE on the citext column), or phone (substring). Filter pills
 * for active / inactive. Defaults to active only.
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type SearchParams = {
  q?: string
  status?: 'active' | 'inactive' | 'all'
}

type DistRow = {
  id: number
  user_id: string
  sponsor_code: string
  sponsor_id: number | null
  is_active: boolean
  current_rank_id: number | null
  joined_at: string
  payout_msisdn: string | null
  payout_msisdn_verified_at: string | null
  kyc_status: string
}

type ProfileRow = {
  id: string
  email: string
  full_name: string
  phone: string | null
}

type RankRow = {
  id: number
  rank_position: number
  rank_name: string
  emoji: string | null
}

export default async function AdminDistributorsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const q = (searchParams.q ?? '').trim()
  const status = searchParams.status ?? 'active'

  const service = createServiceClient()

  // Two-pass search: when a query is present, hit `profiles` first to find
  // matching user_ids by name / email / phone, then narrow distributors to
  // those user_ids OR matching sponsor_code.
  let matchingUserIds: string[] = []
  if (q.length > 0) {
    const pr = await service
      .from('profiles')
      .select('id')
      .or(
        `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
      )
      .limit(200)
    matchingUserIds = (pr.data ?? []).map((p) => (p as { id: string }).id)
  }

  let distQuery = service
    .from('distributors')
    .select(
      'id, user_id, sponsor_code, sponsor_id, is_active, current_rank_id, joined_at, payout_msisdn, payout_msisdn_verified_at, kyc_status',
    )
    .order('joined_at', { ascending: false })
    .limit(200)

  if (status === 'active') distQuery = distQuery.eq('is_active', true)
  if (status === 'inactive') distQuery = distQuery.eq('is_active', false)

  if (q.length > 0) {
    // Sponsor_code prefix match OR user_id in matchingUserIds
    if (matchingUserIds.length > 0) {
      const idList = matchingUserIds.map((id) => `"${id}"`).join(',')
      distQuery = distQuery.or(
        `sponsor_code.ilike.%${q}%,user_id.in.(${idList})`,
      )
    } else {
      distQuery = distQuery.ilike('sponsor_code', `%${q}%`)
    }
  }

  const dr = await distQuery
  const distributors = (dr.data ?? []) as DistRow[]

  // Hydrate profile labels + rank names
  const userIds = Array.from(new Set(distributors.map((d) => d.user_id)))
  const profilesRes = userIds.length
    ? await service
        .from('profiles')
        .select('id, email, full_name, phone')
        .in('id', userIds)
    : { data: [] as ProfileRow[] }
  const profiles = (profilesRes.data ?? []) as ProfileRow[]

  const rankIds = Array.from(
    new Set(
      distributors
        .map((d) => d.current_rank_id)
        .filter((x): x is number => x !== null),
    ),
  )
  const ranksRes = rankIds.length
    ? await service
        .from('config_ranks')
        .select('id, rank_position, rank_name, emoji')
        .in('id', rankIds)
    : { data: [] as RankRow[] }
  const ranks = (ranksRes.data ?? []) as RankRow[]

  return (
    <div className="max-w-6xl">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Distributors</h1>
          <p className="mt-1 text-sm text-neutral-500">
            All distributors. Search by name, email, phone, or sponsor code.
          </p>
        </div>
      </header>

      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <label className="flex flex-1 min-w-[16rem] flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Search
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, email, phone, or LL-XX-XXXX"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
            Status
          </span>
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Apply
        </button>
        {(q || status !== 'active') ? (
          <Link
            href="/admin/distributors"
            className="text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900"
          >
            Reset
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-[0.15em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">MSISDN</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {distributors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                  No matching distributors.
                </td>
              </tr>
            ) : (
              distributors.map((d) => {
                const p = profiles.find((x) => x.id === d.user_id)
                const r = d.current_rank_id
                  ? ranks.find((x) => x.id === d.current_rank_id)
                  : null
                return (
                  <tr key={d.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/distributors/${d.id}`}
                        className="font-medium text-neutral-900 hover:underline"
                      >
                        {p?.full_name ?? `#${d.id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{d.sponsor_code}</td>
                    <td className="px-4 py-3 text-xs">
                      {r ? (
                        <>
                          {r.emoji ? `${r.emoji} ` : ''}
                          {r.rank_name}
                        </>
                      ) : (
                        <span className="text-neutral-400">Newbie</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{p?.email ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {d.payout_msisdn ?? <span className="text-neutral-400">—</span>}
                      {d.payout_msisdn && d.payout_msisdn_verified_at ? (
                        <span className="ml-1 text-emerald-600">✓</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {new Date(d.joined_at).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${
                          d.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {d.is_active ? 'active' : 'inactive'}
                      </span>
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
