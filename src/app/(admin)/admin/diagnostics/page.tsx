/**
 * /admin/diagnostics — live system health.
 *
 * Click "Run diagnostics" (which submits ?run=1) and the server exercises
 * every external dependency and every critical SQL function. Each check
 * returns ok / fail / skip with a short detail string. Mutating RPCs are
 * called with deliberately invalid input and pass if they reject as
 * expected — that proves existence + service-role can invoke them
 * without doing any real damage.
 *
 * No side effects beyond a couple of audit_log rows per run.
 */

import Link from 'next/link'
import { Suspense } from 'react'
import { runDiagnostics, type Check, type CheckStatus } from '@/lib/diagnostics/run'
import { FoundingCodeCard } from '@/components/admin/FoundingCodeCard'

export const dynamic = 'force-dynamic'
// runtime=nodejs because the diagnostics module pulls the service-role
// client + the PayHero/Africa's Talking SDKs that aren't Edge-safe.
export const runtime = 'nodejs'

const STATUS_META: Record<CheckStatus, { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  fail: { label: 'FAIL', color: 'text-rose-700', bg: 'bg-rose-100' },
  skip: { label: 'SKIP', color: 'text-neutral-600', bg: 'bg-neutral-200' },
}

export default async function DiagnosticsPage({
  searchParams,
}: {
  searchParams: { run?: string }
}) {
  const shouldRun = searchParams.run === '1'

  if (!shouldRun) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-eyebrow text-neutral-500">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            Diagnostics
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            Live health check against Supabase, every critical RPC, the
            payment providers, the SMS gateway, and a monthly-close
            dry-run. Mutating functions are exercised with invalid inputs
            and pass if they reject as expected. Two <code>audit_log</code>
            rows are written per run. <strong>One payment-provider hosted
            link is created</strong> (Kes 10) — it stays in pending and
            never charges anyone.
          </p>
        </header>
        <Suspense fallback={null}>
          <FoundingCodeCard />
        </Suspense>
        <Link
          href="/admin/diagnostics?run=1"
          className="inline-flex items-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Run diagnostics →
        </Link>
      </div>
    )
  }

  const result = await runDiagnostics()
  const grouped = new Map<string, Check[]>()
  for (const c of result.checks) {
    const arr = grouped.get(c.group) ?? []
    arr.push(c)
    grouped.set(c.group, arr)
  }

  const overall: CheckStatus =
    result.failCount > 0 ? 'fail' : result.okCount > 0 ? 'ok' : 'skip'

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-eyebrow text-neutral-500">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
            Diagnostics
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Completed in {result.totalMs} ms · {new Date(result.ranAt).toLocaleString()}
          </p>
        </div>
        <Link
          href="/admin/diagnostics?run=1"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Re-run
        </Link>
      </header>

      <Suspense fallback={null}>
        <div className="mb-8">
          <FoundingCodeCard />
        </div>
      </Suspense>

      <div
        className={`mb-8 rounded-lg border p-5 ${
          overall === 'fail'
            ? 'border-rose-300 bg-rose-50'
            : 'border-emerald-300 bg-emerald-50'
        }`}
      >
        <p
          className={`text-sm font-semibold uppercase tracking-[0.2em] ${
            overall === 'fail' ? 'text-rose-800' : 'text-emerald-800'
          }`}
        >
          {overall === 'fail' ? 'Failing' : 'Healthy'}
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          {result.okCount} ok · {result.failCount} fail · {result.skipCount} skipped
        </p>
      </div>

      <div className="space-y-8">
        {[...grouped.entries()].map(([group, items]) => (
          <section key={group}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              {group}
            </h2>
            <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
              {items.map((c, i) => {
                const meta = STATUS_META[c.status]
                return (
                  <li
                    key={`${c.group}-${c.name}-${i}`}
                    className="grid grid-cols-[5rem_1fr_5rem] items-center gap-4 px-4 py-3 text-sm"
                  >
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${meta.bg} ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{c.name}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{c.detail}</p>
                    </div>
                    <span className="text-right font-mono text-xs text-neutral-400">
                      {c.ms}ms
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
