/**
 * /admin/people/tree — full distributor tree viewer.
 *
 * Flat indented list of every distributor in the network. For each:
 *   - depth from the founder (L0 = founder, L1 = direct recruits, …)
 *   - sponsor code
 *   - name + email
 *   - upline (immediate sponsor)
 *   - current rank
 *   - downline size (all descendants regardless of depth)
 *   - joined date
 *   - active status
 *
 * Reads from `distributors`, `profiles`, `distributor_tree` (closure
 * table), and `config_ranks`. Sorted by depth then joined_at so the
 * tree reads top-down chronologically inside each level.
 */

import { redirect } from 'next/navigation'
import { getSession, isAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

export const metadata = { title: 'Comp tree', robots: { index: false } }
export const dynamic = 'force-dynamic'

type DistributorRow = {
  id: number
  sponsor_code: string
  user_id: string
  sponsor_id: number | null
  is_active: boolean
  joined_at: string
  current_rank_id: number | null
}

type ProfileRow = { id: string; email: string; full_name: string }
type TreeRow = { ancestor_id: number; descendant_id: number; depth: number }
type RankRow = { id: number; rank_name: string; emoji: string | null }
type FounderRow = { id: number }

export default async function CompTreePage() {
  const session = await getSession()
  if (!session) redirect('/?reason=auth')
  if (!isAdmin(session)) redirect('/?reason=forbidden')

  const service = createServiceClient()

  const [distRes, profileRes, treeRes, rankRes, founderRes] = await Promise.all([
    service
      .from('distributors')
      .select(
        'id, sponsor_code, user_id, sponsor_id, is_active, joined_at, current_rank_id',
      ),
    service.from('profiles').select('id, email, full_name'),
    service
      .from('distributor_tree')
      .select('ancestor_id, descendant_id, depth'),
    service
      .from('config_ranks')
      .select('id, rank_name, emoji')
      .is('effective_until', null),
    service
      .from('distributors')
      .select('id')
      .is('sponsor_id', null)
      .maybeSingle(),
  ])

  const distributors = (distRes.data ?? []) as DistributorRow[]
  const profilesArr = (profileRes.data ?? []) as ProfileRow[]
  const tree = (treeRes.data ?? []) as TreeRow[]
  const ranksArr = (rankRes.data ?? []) as RankRow[]
  const founder = founderRes.data as FounderRow | null

  const profileById = new Map<string, ProfileRow>(
    profilesArr.map((p) => [p.id, p]),
  )
  const rankById = new Map<number, RankRow>(ranksArr.map((r) => [r.id, r]))
  const distributorById = new Map<number, DistributorRow>(
    distributors.map((d) => [d.id, d]),
  )

  const founderId = founder?.id ?? null

  // Depth from founder = depth in the closure table where ancestor = founder
  const depthFromFounder = new Map<number, number>()
  // Downline size = count of descendants where depth > 0
  const downlineCount = new Map<number, number>()

  for (const t of tree) {
    if (founderId !== null && t.ancestor_id === founderId) {
      depthFromFounder.set(t.descendant_id, t.depth)
    }
    if (t.depth > 0) {
      downlineCount.set(t.ancestor_id, (downlineCount.get(t.ancestor_id) ?? 0) + 1)
    }
  }

  const rows = distributors
    .map((d) => ({
      ...d,
      profile: profileById.get(d.user_id) ?? null,
      parent: d.sponsor_id != null ? distributorById.get(d.sponsor_id) ?? null : null,
      depth: depthFromFounder.get(d.id) ?? 0,
      downlineSize: downlineCount.get(d.id) ?? 0,
      rank: d.current_rank_id != null ? rankById.get(d.current_rank_id) ?? null : null,
    }))
    .sort(
      (a, b) =>
        a.depth - b.depth ||
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
    )

  const maxDepth = Math.max(0, ...Array.from(depthFromFounder.values()))
  const activeCount = distributors.filter((d) => d.is_active).length

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          People
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Comp tree</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Every distributor in the network, sorted by depth from the founding
          distributor. <strong>L0</strong> is the founder, <strong>L1</strong>{' '}
          their direct recruits, and so on. Commission flows up to 7 levels
          deep regardless of how many ranks exist.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-3 text-xs">
        <Stat label="Total" value={distributors.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Max depth" value={`L${maxDepth}`} />
        <Stat
          label="Founder"
          value={founderId ? `dist #${founderId}` : '—'}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <Th>Depth</Th>
              <Th>Sponsor code</Th>
              <Th>Distributor</Th>
              <Th>Upline</Th>
              <Th>Rank</Th>
              <Th align="right">Downline</Th>
              <Th>Joined</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-sm text-neutral-500"
                >
                  No distributors yet.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    {row.depth > 0
                      ? Array.from({ length: row.depth }).map((_, i) => (
                          <span key={i} className="text-neutral-300">
                            ·
                          </span>
                        ))
                      : null}
                    <span className="font-mono text-xs text-neutral-600">
                      L{row.depth}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-amber-700">
                  {row.sponsor_code}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-neutral-900">
                    {row.profile?.full_name ?? '—'}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {row.profile?.email ?? '—'}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                  {row.parent ? (
                    row.parent.sponsor_code
                  ) : (
                    <span className="rounded-full border border-violet-400 bg-violet-50 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                      Founder
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.rank ? (
                    <span>
                      {row.rank.emoji ? `${row.rank.emoji} ` : ''}
                      {row.rank.rank_name}
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-sm">
                  {row.downlineSize}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-500">
                  {new Date(row.joined_at).toLocaleDateString('en-KE', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-3 py-2">
                  {row.is_active ? (
                    <span className="inline-block rounded-full border border-emerald-400 bg-emerald-50 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-neutral-300 bg-neutral-50 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Tree depth reads from <code className="rounded bg-neutral-100 px-1">distributor_tree</code> closure
        table. Downline size counts every descendant at every depth. Rank shows
        the most recently achieved rank per <code className="rounded bg-neutral-100 px-1">distributors.current_rank_id</code>.
      </p>
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-3 py-2 text-${align} text-xs font-medium uppercase tracking-wide text-neutral-500`}
    >
      {children}
    </th>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white px-4 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900">
        {value}
      </p>
    </div>
  )
}
