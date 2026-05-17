'use client'

import { useState, useTransition } from 'react'
import {
  grantRoleAction,
  revokeRoleAction,
} from '@/app/(admin)/admin/system/roles/actions'

export type UserRow = {
  id: string
  email: string
  createdAt: string | null
  lastSignInAt: string | null
  roles: string[] // current non-revoked roles
}

const MANAGEABLE_ROLES = ['admin', 'superadmin'] as const
type ManageableRole = (typeof MANAGEABLE_ROLES)[number]

function roleBadgeCls(role: string): string {
  if (role === 'superadmin')
    return 'border-violet-400 bg-violet-50 text-violet-700'
  if (role === 'admin')
    return 'border-emerald-400 bg-emerald-50 text-emerald-700'
  if (role === 'distributor')
    return 'border-amber-400 bg-amber-50 text-amber-700'
  return 'border-neutral-300 bg-neutral-50 text-neutral-600'
}

export function RolesTable({
  rows,
  currentUserId,
}: {
  rows: UserRow[]
  currentUserId: string
}) {
  const [search, setSearch] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const filtered = rows.filter((r) =>
    r.email.toLowerCase().includes(search.toLowerCase()),
  )

  function onGrant(userId: string, email: string, role: ManageableRole) {
    setError(null)
    setInfo(null)
    if (!confirm(`Grant ${role} to ${email}?`)) return
    startTransition(async () => {
      const res = await grantRoleAction(userId, role)
      if (!res.ok) {
        setError(res.error ?? 'Action failed.')
        return
      }
      setInfo(`Granted ${role} to ${email}.`)
    })
  }

  function onRevoke(userId: string, email: string, role: ManageableRole) {
    setError(null)
    setInfo(null)
    if (userId === currentUserId && role === 'superadmin') {
      setError("You can't revoke your own superadmin role.")
      return
    }
    if (!confirm(`Revoke ${role} from ${email}?`)) return
    startTransition(async () => {
      const res = await revokeRoleAction(userId, role)
      if (!res.ok) {
        setError(res.error ?? 'Action failed.')
        return
      }
      setInfo(`Revoked ${role} from ${email}.`)
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-neutral-900"
        />
        <span className="text-xs text-neutral-500">
          {filtered.length} of {rows.length} users
        </span>
      </div>

      {error ? (
        <div className="mb-3 rounded border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="mb-3 rounded border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {info}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                Roles
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                Last seen
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-neutral-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-sm text-neutral-500"
                >
                  No users match.
                </td>
              </tr>
            ) : null}
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{row.email}</div>
                  {row.id === currentUserId ? (
                    <div className="text-xs text-neutral-500">(you)</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.roles.length === 0 ? (
                      <span className="text-xs text-neutral-400">customer</span>
                    ) : (
                      row.roles.map((r) => (
                        <span
                          key={r}
                          className={`inline-block rounded-full border px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide ${roleBadgeCls(
                            r,
                          )}`}
                        >
                          {r}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {row.lastSignInAt
                    ? new Date(row.lastSignInAt).toLocaleDateString('en-KE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {MANAGEABLE_ROLES.map((role) => {
                      const has = row.roles.includes(role)
                      const isSelfSuperadmin =
                        row.id === currentUserId &&
                        role === 'superadmin' &&
                        has
                      if (has) {
                        return (
                          <button
                            key={role}
                            type="button"
                            disabled={pending || isSelfSuperadmin}
                            onClick={() =>
                              onRevoke(row.id, row.email, role)
                            }
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title={
                              isSelfSuperadmin
                                ? "You can't revoke your own superadmin"
                                : undefined
                            }
                          >
                            Revoke {role}
                          </button>
                        )
                      }
                      return (
                        <button
                          key={role}
                          type="button"
                          disabled={pending}
                          onClick={() => onGrant(row.id, row.email, role)}
                          className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Grant {role}
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Distributor role is granted automatically through the signup flow and
        is not edited here. All grant/revoke actions are recorded in{' '}
        <code className="rounded bg-neutral-100 px-1">audit_log</code>.
      </p>
    </div>
  )
}
