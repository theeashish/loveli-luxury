'use client'

import { useState, useTransition } from 'react'
import { adminSecondaryBtnCls } from '@/components/admin/forms'
import { refreshPartnerQualificationsAction } from './actions'

export function RefreshButton() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<
    { kind: 'ok' | 'error'; text: string } | null
  >(null)

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null)
          startTransition(async () => {
            const res = await refreshPartnerQualificationsAction()
            if ('error' in res) {
              setMsg({ kind: 'error', text: res.error })
            } else {
              setMsg({
                kind: 'ok',
                text: `Recomputed ${res.rowCount} partner row(s).`,
              })
            }
          })
        }}
        className={adminSecondaryBtnCls}
      >
        {pending ? 'Recomputing…' : 'Recompute now'}
      </button>
      {msg ? (
        <span
          className={`text-xs ${
            msg.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  )
}
