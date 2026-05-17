/**
 * /admin/diagnostics top widget — surfaces the founding sponsor code so
 * the admin never has to run SQL to find it. Also lists the most recent
 * distributor signups for quick verification that signups are landing.
 *
 * Server component. Reads via service-role (we're already inside the
 * admin gate; layout enforces role).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { CopyButton } from './CopyButton'

type FounderRow = {
  id: number
  sponsor_code: string
  user_id: string
  is_active: boolean
  joined_at: string
}

type RecentDistributorRow = {
  id: number
  sponsor_code: string
  is_active: boolean
  joined_at: string
}

const SEED_SQL = `INSERT INTO distributors (user_id, sponsor_id, kyc_status, is_active, joined_at)
VALUES ('<YOUR_AUTH_USER_ID>', NULL, 'approved', TRUE, NOW());

-- To find your auth user id:
SELECT id, email FROM auth.users ORDER BY created_at LIMIT 5;`

export async function FoundingCodeCard() {
  const service = createServiceClient()

  const [founderRes, recentRes, countRes] = await Promise.all([
    service
      .from('distributors')
      .select('id, sponsor_code, user_id, is_active, joined_at')
      .is('sponsor_id', null)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    service
      .from('distributors')
      .select('id, sponsor_code, is_active, joined_at')
      .order('joined_at', { ascending: false })
      .limit(5),
    service
      .from('distributors')
      .select('id', { count: 'exact', head: true }),
  ])

  const founder = founderRes.data as FounderRow | null
  const recent = (recentRes.data ?? []) as RecentDistributorRow[]
  const totalDistributors = countRes.count ?? 0

  if (!founder) {
    return (
      <section className="rounded-lg border border-amber-300 bg-amber-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
          Bootstrap required
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-amber-900">
          No founding distributor yet
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-amber-900">
          The system is invite-only, which means a first distributor must
          exist before anyone else can sign up. Open the Supabase SQL
          editor and run this once:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-amber-100 p-4 text-xs leading-relaxed text-amber-900">
          <code>{SEED_SQL}</code>
        </pre>
        <p className="mt-3 text-xs text-amber-800">
          After insert, refresh this page — the auto-generated{' '}
          <code className="font-mono">sponsor_code</code> will appear here.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Founding distributor
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-900">
            Use this code to sponsor any new affiliate
          </h2>
          <p className="mt-2 text-xs text-emerald-800">
            {totalDistributors} distributor{totalDistributors === 1 ? '' : 's'}{' '}
            total · joined {new Date(founder.joined_at).toLocaleDateString()}
            {!founder.is_active ? ' · ⚠ INACTIVE' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded-md border border-emerald-400 bg-white px-4 py-2 font-mono text-base font-semibold text-emerald-900">
            {founder.sponsor_code}
          </code>
          <CopyButton value={founder.sponsor_code} />
        </div>
      </div>

      {recent.length > 1 ? (
        <div className="mt-6 border-t border-emerald-200 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Recent signups
          </p>
          <ul className="space-y-1 text-xs text-emerald-900">
            {recent.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-4"
              >
                <code className="font-mono">{d.sponsor_code}</code>
                <span className="text-emerald-700">
                  {new Date(d.joined_at).toLocaleDateString()}
                  {!d.is_active ? ' (inactive)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
