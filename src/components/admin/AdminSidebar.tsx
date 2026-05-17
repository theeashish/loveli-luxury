'use client'

/**
 * Admin sidebar — single canonical nav for every /admin/* surface.
 *
 * Replaces the 9 per-section layouts that each rebuilt their own
 * sidebar. Groups links into Catalog / Operations / People / Comp /
 * System so admins can find things without memorising deep paths.
 *
 * Active state via usePathname — longest-prefix match wins so e.g.
 * /admin/catalog/bundles/12 highlights "Bundles", not "Overview".
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from '@/lib/auth/signout-action'

type NavItem = { href: string; label: string }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Catalog',
    items: [
      { href: '/admin/catalog', label: 'Overview' },
      { href: '/admin/catalog/products', label: 'Products' },
      { href: '/admin/catalog/bundles', label: 'Bundles' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/orders', label: 'Orders' },
      { href: '/admin/payouts', label: 'Payouts' },
      { href: '/admin/close', label: 'Monthly close' },
      { href: '/admin/clawbacks', label: 'Clawbacks' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/distributors', label: 'Distributors' },
      { href: '/admin/distributors/verifications', label: 'KYC queue' },
      { href: '/admin/people/tree', label: 'Comp tree' },
    ],
  },
  {
    label: 'Comp',
    items: [
      { href: '/admin/comp/starter-packages', label: 'Starter packages' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/system/roles', label: 'User roles' },
      { href: '/admin/diagnostics', label: 'Diagnostics' },
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/analytics/cohorts', label: 'Cohorts' },
    ],
  },
] as const

const ALL_HREFS: readonly string[] = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => i.href),
)

interface Props {
  email: string
  isSuperadmin: boolean
}

export function AdminSidebar({ email, isSuperadmin }: Props) {
  const pathname = usePathname()

  // Longest-prefix-match active resolution. Walk all hrefs, find the
  // most specific one that's either an exact match or a directory
  // ancestor of pathname.
  const bestMatch = [...ALL_HREFS]
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0]

  const roleLabel = isSuperadmin ? 'Superadmin' : 'Admin'
  const roleBadgeCls = isSuperadmin
    ? 'border-violet-400 bg-violet-50 text-violet-700'
    : 'border-emerald-400 bg-emerald-50 text-emerald-700'

  return (
    <aside className="flex h-screen flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 p-6">
        <Link
          href="/admin"
          className="block text-lg font-semibold tracking-tight text-neutral-900"
        >
          Loveli <span className="text-neutral-400">— admin</span>
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-xs text-neutral-500">
            {email}
          </span>
          <span
            className={`inline-block flex-none rounded-full border px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[0.15em] ${roleBadgeCls}`}
          >
            {roleLabel}
          </span>
        </div>
        <Link
          href="/"
          className="mt-3 inline-flex items-center gap-1 text-xs text-neutral-600 transition hover:text-neutral-900"
        >
          ← View site
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.href === bestMatch
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded px-3 py-2 text-sm transition ${
                        active
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-neutral-200 p-4">
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
