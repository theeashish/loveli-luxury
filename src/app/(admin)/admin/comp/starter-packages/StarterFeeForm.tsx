'use client'

import { useState, useTransition } from 'react'
import {
  adminInputCls,
  adminPrimaryBtnCls,
} from '@/components/admin/forms'
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
          className="mb-1.5 block text-sm font-medium text-neutral-800"
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
          className={`${adminInputCls} tabular-nums`}
        />
      </div>
      <button
        type="submit"
        disabled={!dirty || pending}
        className={adminPrimaryBtnCls}
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
