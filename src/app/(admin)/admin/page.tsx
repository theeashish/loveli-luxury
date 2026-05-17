/**
 * /admin root — temporary redirect to /admin/catalog while the real
 * overview dashboard (Step 2 of the admin UX cleanup) is built.
 *
 * Replaces the prior 404 behaviour where the bare /admin URL had no
 * page file. Future: this becomes the cross-section overview with
 * today's signups, pending refunds, KYC queue size, etc.
 */

import { redirect } from 'next/navigation'

export const metadata = { title: 'Admin', robots: { index: false } }

export default function AdminRootPage() {
  redirect('/admin/catalog')
}
