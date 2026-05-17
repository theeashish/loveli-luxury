'use client'

import { useState, useTransition } from 'react'
import { updateStarterJoiningFee } from './actions'

export function StarterFeeForm({
  packageCode,
  currentJoiningFeeKes,
}: {
  packageCode: string
  currentJoiningFeeKes: number
}) {
  const [value, setValue] = useState(currentJoiningFeeKes)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null,
  )

  const dirty = value !== currentJoiningFeeKes

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setMsg(null)
        startTransition(async () => {
          const res = await updateStarterJoiningFee({
            packageCode,
            joiningFeeKes: value,
          })
          if ('error' in res) {
            setMsg({ kind: 'error', text: res.error })
          } else {
            setMsg({
              kind: 'ok',
              text: `Joining fee updated to Kes ${value.toLocaleString()}.`,
            })
          }
        })
      }}
      className="flex items-end gap-3"
    >
      <div className="flex-1">
        <label
          htmlFor={`fee-${packageCode}`}
          className="mb-1 block text-xs font-medium uppercase tracking-[0.15em] text-neutral-600"
        >
          Joining fee (KES)
        </label>
        <input
          id={`fee-${packageCode}`}
          type="number"
          min={0}
          max={1_000_000}
          step={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-neutral-900 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={!dirty || pending}
        className="rounded-md bg-neutral-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
      {msg ? (
        <span
          className={`ml-3 text-xs ${
            msg.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {msg.text}
        </span>
      ) : null}
    </form>
  )
}
