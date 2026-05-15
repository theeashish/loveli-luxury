import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { getSession, isAdmin } from '@/lib/auth/roles'

export const metadata = {
  title: 'Clawback resolutions',
  robots: { index: false, follow: false },
}

const NAV = [
  { href: '/admin/distributors', label: 'Distributors' },
  { href: '/admin/distributors/verifications', label: 'Verifications' },
  { href: '/admin/clawbacks', label: 'Clawbacks' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/payouts', label: 'Payouts' },
  { href: '/admin/close', label: 'Monthly close' },
  { href: '/admin/catalog', label: 'Catalog' },
] as const

export default async function ClawbacksAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/?reason=auth')
  if (!isAdmin(session)) redirect('/?reason=forbidden')

  return (
    <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-neutral-50">
      <aside className="border-r border-neutral-200 bg-white p-6">
        <div className="mb-8">
          <Link href="/admin/clawbacks" className="text-lg font-semibold tracking-tight">
            Loveli — admin
          </Link>
          <p className="mt-1 text-xs text-neutral-500">
            {session.email ?? session.userId}
          </p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-neutral-700 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="overflow-y-auto p-8">
        {children}
        <Toaster position="bottom-right" />
      </main>
    </div>
  )
}
