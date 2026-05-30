'use client'

import { useState, useTransition } from 'react'
import { deactivateUser } from './actions'

const PROTECTED_EMAILS = new Set<string>([
  'capernstone@gmail.com',
  'ashishke79@gmail.com',
  'ashirumaabala1@gmail.com',
  'rymiruzz@gmail.com',
])

export function UserRow({
  user,
  isSelf,
}: {
  user: {
    id: string
    email: string | null
    createdAt: string | null
    roles: string[]
    banned: boolean
  }
  isSelf: boolean
}) {
  const [confirmEmail, setConfirmEmail] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const email = user.email ?? ''
  const isProtected = email && PROTECTED_EMAILS.has(email.toLowerCase())
  const canDeactivate = !isSelf && !isProtected && !user.banned

  const handleDeactivate = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await deactivateUser({ userId: user.id, confirmEmail })
      if (res.ok) {
        setMessage({ kind: 'ok', text: res.message })
        setOpen(false)
        setConfirmEmail('')
      } else {
        setMessage({ kind: 'err', text: res.error })
      }
    })
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{email || '(no email)'}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {user.id} ·{' '}
            {user.createdAt
              ? new Date(user.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' })
              : 'unknown date'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.length === 0 ? (
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
                no roles
              </span>
            ) : (
              user.roles.map((r) => (
                <span
                  key={r}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    r === 'superadmin'
                      ? 'bg-amber-100 text-amber-900'
                      : r === 'admin'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  {r}
                </span>
              ))
            )}
            {isProtected && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
                PROTECTED
              </span>
            )}
            {user.banned && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-900">
                DEACTIVATED
              </span>
            )}
            {isSelf && (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-900">
                YOU
              </span>
            )}
          </div>
        </div>
        {canDeactivate && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
          >
            {open ? 'Cancel' : 'Deactivate'}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-900">
            Type <strong className="font-mono">{email}</strong> below to confirm. The
            account will be banned, all roles revoked, and the email anonymised so it
            can be re-registered. Reversible by an engineer with DB access.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              className="flex-1 rounded border border-rose-300 bg-white px-3 py-1.5 text-sm font-mono text-neutral-900 focus:border-rose-500 focus:outline-none"
            />
            <button
              onClick={handleDeactivate}
              disabled={pending || confirmEmail.toLowerCase() !== email.toLowerCase()}
              className="rounded bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Working…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`mt-3 rounded border p-2 text-xs ${
            message.kind === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-rose-300 bg-rose-50 text-rose-900'
          }`}
        >
          {message.text}
        </div>
      )}
    </li>
  )
}
