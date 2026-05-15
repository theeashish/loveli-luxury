/**
 * Distributor overview.
 *
 * Pulls a small summary for the current month: GSV snapshot row (if any),
 * latest commissions (top 8), and the next-rank thresholds so the
 * distributor sees how far they have to go. Data lookups go through the
 * service-role client because the layout has already verified the caller
 * is a distributor; we don't need RLS to scope here.
 */

import Link from 'next/link'
import { getCurrentDistributor } from '@/lib/distributors/current'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'

export const dynamic = 'force-dynamic'

type SnapshotRow = {
  personal_bottles_sold: number
  personal_sales_minor: string
  team_gsv_minor: string
  active_recruits_count: number
  computed_at: string
}

type LedgerRow = {
  id: number
  level: number
  amount_minor: string
  earned_at: string
  source_order_id: number
}

type RankRow = {
  rank_position: number
  rank_name: string
  emoji: string | null
  min_active_recruits: number
  min_group_sales_minor: string
}

export default async function DistributorOverviewPage() {
  const distributor = await getCurrentDistributor()
  if (!distributor) return null // layout redirects, this is just for types

  const service = createServiceClient()

  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  const [snapRes, ledgerRes, ranksRes, downlineRes] = await Promise.all([
    service
      .from('gsv_snapshots')
      .select(
        'personal_bottles_sold, personal_sales_minor, team_gsv_minor, active_recruits_count, computed_at',
      )
      .eq('distributor_id', distributor.id)
      .eq('period_year', year)
      .eq('period_month', month)
      .maybeSingle(),
    service
      .from('commission_ledger')
      .select('id, level, amount_minor, earned_at, source_order_id')
      .eq('distributor_id', distributor.id)
      .order('earned_at', { ascending: false })
      .limit(8),
    service
      .from('config_ranks')
      .select('rank_position, rank_name, emoji, min_active_recruits, min_group_sales_minor')
      .is('effective_until', null)
      .order('rank_position'),
    service
      .from('distributor_tree')
      .select('depth')
      .eq('ancestor_id', distributor.id)
      .gt('depth', 0),
  ])

  const snapshot = (snapRes.data as SnapshotRow | null) ?? null
  const ledger = (ledgerRes.data ?? []) as LedgerRow[]
  const ranks = (ranksRes.data ?? []) as RankRow[]
  const downline = (downlineRes.data ?? []) as Array<{ depth: number }>

  const teamGsv = snapshot ? BigInt(snapshot.team_gsv_minor) : 0n
  const activeRecruits = snapshot?.active_recruits_count ?? 0

  // Next-rank progress — find first rank above the distributor's current
  // rank_position. We're using the live ranks list here; close uses the
  // snapshot at end-of-period.
  const currentPos = distributor.currentRankPosition ?? 1
  const nextRank = ranks.find((r) => r.rank_position === currentPos + 1)

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          label="Team GSV"
          value={formatKes(teamGsv)}
          sub={`${year}-${String(month).padStart(2, '0')}`}
        />
        <Stat
          label="Personal sales"
          value={formatKes(BigInt(snapshot?.personal_sales_minor ?? '0'))}
          sub={`${snapshot?.personal_bottles_sold ?? 0} bottles`}
        />
        <Stat label="Active recruits" value={String(activeRecruits)} sub="this month" />
        <Stat label="Downline size" value={String(downline.length)} sub="all depths" />
      </section>

      {nextRank ? (
        <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
          <h2 className="text-base font-medium">
            Next rank: {nextRank.emoji ? `${nextRank.emoji} ` : ''}
            {nextRank.rank_name}
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            What it takes to promote.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Progress
              label="Active recruits"
              current={activeRecruits}
              target={nextRank.min_active_recruits}
              format={(n) => String(n)}
            />
            <Progress
              label="Team GSV"
              current={Number(teamGsv) / 100}
              target={Number(BigInt(nextRank.min_group_sales_minor)) / 100}
              format={(n) =>
                new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  maximumFractionDigits: 0,
                }).format(n)
              }
            />
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
          <h2 className="text-base font-medium">
            Top rank reached {distributor.currentRankEmoji ?? ''}
          </h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            You're at the highest rank in the current comp plan.
          </p>
        </section>
      )}

      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Recent commissions</h2>
          <Link
            href="/account/distributor/commissions"
            className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
          >
            See all →
          </Link>
        </header>
        {ledger.length === 0 ? (
          <p className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-6 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No commissions earned yet. Share your sponsor link to get started.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
            {ledger.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-6 px-6 py-4 text-sm"
              >
                <div>
                  <p className="font-mono">L{l.level} · order #{l.source_order_id}</p>
                  <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {new Date(l.earned_at).toLocaleString('en-KE', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatKes(BigInt(l.amount_minor))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-5">
      <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-light tabular-nums">{value}</p>
      {sub ? (
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{sub}</p>
      ) : null}
    </div>
  )
}

function Progress({
  label,
  current,
  target,
  format,
}: {
  label: string
  current: number
  target: number
  format: (n: number) => string
}) {
  const ratio = target > 0 ? Math.min(1, current / target) : 0
  const pct = Math.round(ratio * 100)
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
        <span className="tabular-nums">
          {format(current)} <span className="text-[hsl(var(--muted-foreground))]">/</span>{' '}
          {format(target)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--border))]">
        <div
          className="h-full bg-[hsl(var(--primary))]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
