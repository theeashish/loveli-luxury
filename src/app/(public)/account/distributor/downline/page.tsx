/**
 * Downline tree — every descendant of the current distributor up to the
 * 7-level cap, rendered as an indented tree (parent → children) using
 * the direct-sponsor edge in `distributors.sponsor_id` rather than the
 * closure table's depth alone. Per-level counters at the top remain a
 * useful at-a-glance.
 *
 * Email + phone are hidden — admins see those, distributors don't.
 */

import { getCurrentDistributor } from '@/lib/distributors/current'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

type TreeRow = { descendant_id: number; depth: number }
type DistRow = {
  id: number
  user_id: string
  sponsor_id: number | null
  sponsor_code: string
  joined_at: string
  is_active: boolean
  current_rank_id: number | null
}
type ProfileRow = { id: string; full_name: string }
type RankRow = { id: number; rank_position: number; rank_name: string; emoji: string | null }

type Node = {
  distributor: DistRow
  profile: ProfileRow | null
  rank: RankRow | null
  depth: number
  children: Node[]
}

export default async function DownlinePage() {
  const me = await getCurrentDistributor()
  if (!me) return null

  const service = createServiceClient()

  const treeRes = await service
    .from('distributor_tree')
    .select('descendant_id, depth')
    .eq('ancestor_id', me.id)
    .gt('depth', 0)
    .order('depth')
  const tree = (treeRes.data ?? []) as TreeRow[]

  const ids = tree.map((t) => t.descendant_id)
  if (ids.length === 0) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        No one in your downline yet. Share your sponsor link to recruit.
      </div>
    )
  }

  const distRes = await service
    .from('distributors')
    .select(
      'id, user_id, sponsor_id, sponsor_code, joined_at, is_active, current_rank_id',
    )
    .in('id', ids)
  const dists = (distRes.data ?? []) as DistRow[]

  const userIds = Array.from(new Set(dists.map((d) => d.user_id)))
  const profilesRes = await service
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)
  const profiles = (profilesRes.data ?? []) as ProfileRow[]

  const rankIds = Array.from(
    new Set(
      dists
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

  // Per-level counts
  const byDepth = new Map<number, number>()
  for (const t of tree) byDepth.set(t.depth, (byDepth.get(t.depth) ?? 0) + 1)

  // Build the tree. Root nodes are distributors whose sponsor_id === me.id.
  const depthByDescendant = new Map(tree.map((t) => [t.descendant_id, t.depth]))
  const nodeById = new Map<number, Node>()
  for (const d of dists) {
    nodeById.set(d.id, {
      distributor: d,
      profile: profiles.find((p) => p.id === d.user_id) ?? null,
      rank: d.current_rank_id
        ? ranks.find((r) => r.id === d.current_rank_id) ?? null
        : null,
      depth: depthByDescendant.get(d.id) ?? 0,
      children: [],
    })
  }

  const roots: Node[] = []
  for (const node of nodeById.values()) {
    const parentId = node.distributor.sponsor_id
    if (parentId === me.id || parentId === null) {
      roots.push(node)
      continue
    }
    const parent = nodeById.get(parentId)
    if (parent) {
      parent.children.push(node)
    } else {
      // Orphan (shouldn't happen given the tree filter, but be safe)
      roots.push(node)
    }
  }

  // Stable sort: oldest first within each level
  const sortChildren = (n: Node) => {
    n.children.sort(
      (a, b) =>
        new Date(a.distributor.joined_at).getTime() -
        new Date(b.distributor.joined_at).getTime(),
    )
    n.children.forEach(sortChildren)
  }
  roots.sort(
    (a, b) =>
      new Date(a.distributor.joined_at).getTime() -
      new Date(b.distributor.joined_at).getTime(),
  )
  roots.forEach(sortChildren)

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => (
          <div
            key={d}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-center"
          >
            <p className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
              L{d}
            </p>
            <p className="mt-1 text-lg font-light tabular-nums">
              {byDepth.get(d) ?? 0}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4">
        <ul className="space-y-1 text-sm">
          {roots.map((root) => (
            <TreeNode key={root.distributor.id} node={root} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function TreeNode({ node }: { node: Node }) {
  const indent = `${(node.depth - 1) * 1.25}rem`
  return (
    <li>
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-l border-[hsl(var(--border))] px-3 py-2"
        style={{ marginLeft: indent }}
      >
        <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
          L{node.depth}
        </span>
        <span className="font-medium">
          {node.profile?.full_name ?? (
            <span className="text-[hsl(var(--muted-foreground))]">—</span>
          )}
        </span>
        <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
          {node.distributor.sponsor_code}
        </span>
        {node.rank ? (
          <span className="text-xs">
            {node.rank.emoji ? `${node.rank.emoji} ` : ''}
            {node.rank.rank_name}
          </span>
        ) : (
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Starter</span>
        )}
        {!node.distributor.is_active ? (
          <span className="text-[10px] uppercase tracking-[0.15em] text-rose-500">
            inactive
          </span>
        ) : null}
        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
          joined{' '}
          {new Date(node.distributor.joined_at).toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
      {node.children.length > 0 ? (
        <ul className="space-y-1">
          {node.children.map((c) => (
            <TreeNode key={c.distributor.id} node={c} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}
