import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import { getSession, isAdmin } from '@/lib/auth/roles'

export const metadata = {
  title: 'Starter packages',
  robots: { index: false, follow: false },
}

const NAV = [
  { href: '/admin/comp/starter-packages', label: 'Starter packages' },
] as const

export default async function CompAdminLayout({
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
          <Link
            href="/admin/comp/starter-packages"
            className="text-lg font-semibold tracking-tight"
          >
            Loveli — comp plan
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
        <hr className="my-6 border-neutral-200" />
        <nav className="flex flex-col gap-1 text-xs uppercase tracking-[0.15em] text-neutral-500">
          <Link href="/admin/catalog" className="rounded px-3 py-2 hover:bg-neutral-100">
            Catalog
          </Link>
          <Link href="/admin/orders" className="rounded px-3 py-2 hover:bg-neutral-100">
            Orders
          </Link>
          <Link href="/admin/diagnostics" className="rounded px-3 py-2 hover:bg-neutral-100">
            Diagnostics
          </Link>
        </nav>
      </aside>
      <main className="p-8">{children}</main>
      <Toaster richColors position="top-right" />
    </div>
  )
}
