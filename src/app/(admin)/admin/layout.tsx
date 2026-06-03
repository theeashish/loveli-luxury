/**
 * Admin root layout — single canonical shell for every /admin/* page.
 *
 * Replaces the 9 per-section layouts that each duplicated the sidebar.
 * Each section page now inherits this layout automatically.
 *
 * Auth check is defensive (middleware already gates /admin/*). Sidebar
 * is a client component so we can use usePathname for active state.
 */

import { redirect } from 'next/navigation'
import { Toaster } from '@/lib/toast'
import { getSession, isAdmin, adminMfaRedirect } from '@/lib/auth/roles'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/?reason=auth')
  if (!isAdmin(session)) redirect('/?reason=forbidden')

  // 2FA step-up gate — inert unless ENFORCE_ADMIN_MFA=true; never locks out
  // un-enrolled admins (see adminMfaRedirect).
  const mfaRedirect = await adminMfaRedirect()
  if (mfaRedirect) redirect(mfaRedirect)

  const isSuperadmin = session.roles.has('superadmin')

  return (
    <div className="grid min-h-screen grid-cols-[16rem_1fr] bg-neutral-50">
      <AdminSidebar
        email={session.email ?? session.userId}
        isSuperadmin={isSuperadmin}
      />
      <main className="overflow-y-auto p-8 text-neutral-900">{children}</main>
      <Toaster />
    </div>
  )
}
