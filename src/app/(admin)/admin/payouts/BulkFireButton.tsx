'use client'

import { useState, useTransition } from 'react'
import {
  fireAllEligiblePayouts,
  type BulkFireResult,
} from './bulk-actions'

/**
 * Bulk-fire UI for /admin/payouts.
 *
 * Two-stage: typed confirmation ("FIRE N") to prevent finger-slip, then
 * the actual fire. Reports every outcome in a per-row table so the
 * operator sees exactly what happened.
 *
 * Same safety gates as the per-payout button (ENABLE_PAYOUTS, MSISDN
 * verified, MSISDN unchanged). The server enforces them again — this
 * UI cannot be used to bypass any check.
 */
export function BulkFireButton({ pendingCount }: { pendingCount: number }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [result, setResult] = useState<BulkFireResult | null>(null)
  const [pending, startTransition] = useTransition()

  const expectedConfirm = `FIRE ${pendingCount}`
  const canFire = pendingCount > 0 && confirm.trim() === expectedConfirm

  function run() {
    setResult(null)
    startTransition(async () => {
      const res = await fireAllEligiblePayouts({})
      setResult(res)
      setConfirm('')
    })
  }

  if (pendingCount === 0) {
    return (
      <span className="text-xs text-neutral-500">No pending payouts.</span>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setOpen((v) => !v)
            setResult(null)
            setConfirm('')
          }}
          className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
        >
          {open ? 'Cancel' : `Fire all ${pendingCount} pending`}
        </button>
        <span className="text-xs text-neutral-500">
          Same safety gates as per-payout: MSISDN verified, no drift, ENABLE_PAYOUTS on.
        </span>
      </div>

      {open && !result && (
        <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-4">
          <p className="text-sm text-rose-900">
            <strong>This fires real B2C transfers</strong> from the IntaSend
            wallet to every eligible pending payout. Each fire is logged.
            Failures roll back to <code className="font-mono">pending</code>{' '}
            and can be retried. Type{' '}
            <strong className="font-mono">{expectedConfirm}</strong> to confirm.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={expectedConfirm}
              className="flex-1 rounded border border-rose-400 bg-white px-3 py-1.5 text-sm font-mono text-neutral-900 focus:border-rose-600 focus:outline-none"
            />
            <button
              onClick={run}
              disabled={pending || !canFire}
              className="rounded bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Firing…' : 'Confirm fire'}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`mt-3 rounded-md border p-4 ${
            result.ok
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-rose-300 bg-rose-50'
          }`}
        >
          {result.ok ? (
            <>
              <p className="text-sm font-medium text-emerald-900">
                Bulk fire complete · fired {result.summary.fired} · skipped{' '}
                {result.summary.skipped} · failed {result.summary.failed}
              </p>
              {result.outcomes.length > 0 && (
                <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs">
                  {result.outcomes.map((o) => (
                    <li
                      key={o.payoutId}
                      className={`rounded border px-2 py-1 ${
                        o.status === 'fired'
                          ? 'border-emerald-300 bg-white text-emerald-900'
                          : o.status === 'skipped'
                            ? 'border-amber-300 bg-white text-amber-900'
                            : 'border-rose-300 bg-white text-rose-900'
                      }`}
                    >
                      <span className="font-mono">#{o.payoutId}</span> ·{' '}
                      <strong>{o.status}</strong>
                      {o.status === 'fired' && (
                        <>
                          {' '}
                          · KES {o.amountKes}
                          {o.reference ? ` · ref ${o.reference}` : ''}
                        </>
                      )}
                      {o.status === 'skipped' && <> · reason: {o.reason}</>}
                      {o.status === 'failed' && <> · {o.error}</>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-rose-900">{result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
