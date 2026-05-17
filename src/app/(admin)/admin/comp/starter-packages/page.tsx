/**
 * /admin/comp/starter-packages
 *
 * List view of every starter package with editable joining fee. The
 * bundle prices themselves are edited from /admin/catalog/bundles.
 *
 * Versioned writes via the effective_from/effective_until pattern —
 * see actions.ts.
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { formatKes } from '@/lib/money'
import { StarterFeeForm } from './StarterFeeForm'

export const metadata = { title: 'Starter packages', robots: { index: false } }
export const dynamic = 'force-dynamic'

type Row = {
  package_code: string
  joining_fee_minor: string | number
  effective_from: string
  bundle: {
    id: number
    slug: string
    name: string
    retail_price_minor: string | number
    is_active: boolean
  } | null
}

export default async function StarterPackagesAdminPage() {
  const service = createServiceClient()

  // Active starter-package configs (effective_until IS NULL)
  const cspRes = await service
    .from('config_starter_packages')
    .select(
      'package_code, joining_fee_minor, effective_from, bundle_id',
    )
    .is('effective_until', null)
    .order('package_code', { ascending: true })

  const cspRows = (cspRes.data ?? []) as Array<{
    package_code: string
    joining_fee_minor: string | number
    effective_from: string
    bundle_id: number
  }>

  // Hydrate bundle details
  const bundleIds = cspRows.map((r) => r.bundle_id)
  let bundlesById = new Map<number, Row['bundle']>()
  if (bundleIds.length > 0) {
    const bRes = await service
      .from('bundles')
      .select('id, slug, name, retail_price_minor, is_active')
      .in('id', bundleIds)
    const bRows = (bRes.data ?? []) as Array<{
      id: number
      slug: string
      name: string
      retail_price_minor: string | number
      is_active: boolean
    }>
    bundlesById = new Map(bRows.map((b) => [b.id, b]))
  }

  const rows: Row[] = cspRows.map((r) => ({
    package_code: r.package_code,
    joining_fee_minor: r.joining_fee_minor,
    effective_from: r.effective_from,
    bundle: bundlesById.get(r.bundle_id) ?? null,
  }))

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-eyebrow text-neutral-500">Comp plan</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Starter packages
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Each starter package binds a bundle (which carries the product
          price) to a joining fee. The customer pays{' '}
          <code>bundle price + joining fee + processing fee</code> at signup.
          Updates here close the active row and insert a new one so full
          history is preserved.
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Bundle prices and contents are edited on the{' '}
          <Link
            href="/admin/catalog/bundles"
            className="text-neutral-900 underline-offset-4 hover:underline"
          >
            catalog → bundles
          </Link>{' '}
          page.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          No active starter packages are configured. Distributor signup will
          fail until at least one row exists in <code>config_starter_packages</code>
          {' '}with <code>effective_until IS NULL</code>.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article
              key={r.package_code}
              className="rounded-lg border border-neutral-200 bg-white p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-6">
                <div>
                  <p className="text-eyebrow text-neutral-500">
                    Package {r.package_code}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                    {r.bundle?.name ?? '(no bundle linked)'}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Bundle price:{' '}
                    {r.bundle ? formatKes(BigInt(r.bundle.retail_price_minor)) : '—'}{' '}
                    · Joining fee:{' '}
                    <strong>{formatKes(BigInt(r.joining_fee_minor))}</strong>
                    {' '}· Active since{' '}
                    {new Date(r.effective_from).toLocaleDateString()}
                  </p>
                  {r.bundle && !r.bundle.is_active ? (
                    <p className="mt-2 text-xs text-amber-700">
                      ⚠ Linked bundle is currently inactive — customers won't
                      see this package on /distributors/signup until you
                      re-activate it on the catalog page.
                    </p>
                  ) : null}
                </div>
              </div>
              <StarterFeeForm
                packageCode={r.package_code}
                currentJoiningFeeKes={Number(BigInt(r.joining_fee_minor) / 100n)}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
