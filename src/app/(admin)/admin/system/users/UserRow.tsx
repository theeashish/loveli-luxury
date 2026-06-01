'use client'

import { useState, useTransition } from 'react'
import {
  deactivateUser,
  hardDeleteUser,
  checkHardDeleteSafety,
  type HardDeleteSafetyBlock,
} from './actions'

const PROTECTED_EMAILS = new Set<string>([
  'capernstone@gmail.com',
  'ashishke79@gmail.com',
  'ashirumaabala1@gmail.com',
  'rymiruzz@gmail.com',
])

type Mode = null | 'deactivate' | 'hard_delete'

type Preview = {
  profile_exists: boolean
  addresses_count: number
  distributors_count: number
  orphan_orders_count: number
}

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
  const [mode, setMode] = useState<Mode>(null)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  // For hard-delete: pull the safety check when the mode is opened. The check
  // tells us whether the action is allowed and what we'd be removing.
  const [safety, setSafety] = useState<
    | { loading: true }
    | { loading: false; safe: boolean; blocks: HardDeleteSafetyBlock[]; preview: Preview }
    | null
  >(null)

  const email = user.email ?? ''
  const isProtected = email && PROTECTED_EMAILS.has(email.toLowerCase())
  const isDeleted = email.endsWith('@deleted.local')
  const canDeactivate = !isSelf && !isProtected && !user.banned
  const canHardDelete = !isSelf && !isProtected
  // Even deactivated (banned, anonymised) accounts can be hard-deleted if no
  // financial history is left — that's what the safety check decides.

  const openHardDelete = () => {
    setMode('hard_delete')
    setMessage(null)
    setSafety({ loading: true })
    startTransition(async () => {
      const res = await checkHardDeleteSafety(user.id)
      if (!res.ok) {
        setSafety(null)
        setMessage({ kind: 'err', text: res.error })
        setMode(null)
        return
      }
      setSafety({
        loading: false,
        safe: res.safe,
        blocks: res.blocks,
        preview: res.preview,
      })
    })
  }

  const cancel = () => {
    setMode(null)
    setConfirmEmail('')
    setSafety(null)
  }

  const handleDeactivate = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await deactivateUser({ userId: user.id, confirmEmail })
      if (res.ok) {
        setMessage({ kind: 'ok', text: res.message })
        cancel()
      } else {
        setMessage({ kind: 'err', text: res.error })
      }
    })
  }

  const handleHardDelete = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await hardDeleteUser({ userId: user.id, confirmEmail })
      if (res.ok) {
        setMessage({ kind: 'ok', text: res.message })
        cancel()
      } else {
        const blockList =
          res.blocks && res.blocks.length
            ? '\n' + res.blocks.map((b) => `• ${b.detail}`).join('\n')
            : ''
        setMessage({ kind: 'err', text: `${res.error}${blockList}` })
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
            {user.banned && !isDeleted && (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-900">
                DEACTIVATED
              </span>
            )}
            {isDeleted && (
              <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white">
                DELETED
              </span>
            )}
            {isSelf && (
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-900">
                YOU
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canDeactivate && mode === null && (
            <button
              onClick={() => {
                setMode('deactivate')
                setMessage(null)
              }}
              className="rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50"
            >
              Deactivate
            </button>
          )}
          {canHardDelete && mode === null && (
            <button
              onClick={openHardDelete}
              className="rounded border border-rose-400 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Delete permanently
            </button>
          )}
          {mode !== null && (
            <button
              onClick={cancel}
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {mode === 'deactivate' && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            <strong>Deactivate (reversible)</strong> — bans the account, revokes all
            roles, anonymises the email, and flips any distributor row to inactive.
            The financial audit trail is preserved. Type{' '}
            <strong className="font-mono">{email}</strong> below to confirm.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={email}
              className="flex-1 rounded border border-amber-300 bg-white px-3 py-1.5 text-sm font-mono text-neutral-900 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleDeactivate}
              disabled={pending || confirmEmail.toLowerCase() !== email.toLowerCase()}
              className="rounded bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? 'Working…' : 'Deactivate'}
            </button>
          </div>
        </div>
      )}

      {mode === 'hard_delete' && safety && (
        <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-3">
          {safety.loading ? (
            <p className="text-xs text-rose-900">Checking safety…</p>
          ) : safety.safe ? (
            <>
              <p className="text-xs text-rose-900">
                <strong>Delete permanently (NOT reversible)</strong> — removes the
                auth user, profile, addresses, distributor row, and closure-tree
                links. {safety.preview.orphan_orders_count} non-financial order(s)
                will be orphaned (kept for audit, but no longer linked to a person).
                Type <strong className="font-mono">{email}</strong> below to confirm.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-rose-800 sm:grid-cols-4">
                <span>profile: {safety.preview.profile_exists ? '1' : '0'}</span>
                <span>addresses: {safety.preview.addresses_count}</span>
                <span>distributor: {safety.preview.distributors_count}</span>
                <span>orphan orders: {safety.preview.orphan_orders_count}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={email}
                  className="flex-1 rounded border border-rose-400 bg-white px-3 py-1.5 text-sm font-mono text-neutral-900 focus:border-rose-600 focus:outline-none"
                />
                <button
                  onClick={handleHardDelete}
                  disabled={pending || confirmEmail.toLowerCase() !== email.toLowerCase()}
                  className="rounded bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? 'Working…' : 'Delete permanently'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-rose-900">
                <strong>Hard delete REFUSED.</strong> This account has audit-required
                financial history. Use <em>Deactivate</em> instead, or purge each
                blocking item via its own admin page first.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] text-rose-900">
                {safety.blocks.map((b) => (
                  <li key={b.reason}>{b.detail}</li>
                ))}
              </ul>
            </>
          )}
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
          <pre className="whitespace-pre-wrap font-sans">{message.text}</pre>
        </div>
      )}
    </li>
  )
}
