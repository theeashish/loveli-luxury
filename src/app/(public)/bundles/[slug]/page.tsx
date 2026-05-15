import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getBundleBySlug, listActiveBundleSlugs } from '@/lib/catalog/queries'
import { ProductGallery } from '@/components/catalog/ProductGallery'
import { BundleContents } from '@/components/catalog/BundleContents'
import { BundleAddToCart } from '@/components/catalog/BundleAddToCart'

// Catalog reads go through the auth-bound Supabase client which calls
// cookies() at request time — incompatible with static generation
// (DYNAMIC_SERVER_USAGE). Force dynamic so each request renders fresh.
// Phase 9 follow-up: route catalog reads through the service-role client
// and re-enable ISR for the cache hit.
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateStaticParams() {
  const slugs = await listActiveBundleSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const bundle = await getBundleBySlug(params.slug)
  if (!bundle) return { title: 'Not found' }
  return {
    title: bundle.name,
    description: bundle.description ?? undefined,
    openGraph: { title: bundle.name, description: bundle.description ?? undefined, type: 'website' },
  }
}

export default async function BundlePage({ params }: { params: { slug: string } }) {
  const bundle = await getBundleBySlug(params.slug)
  if (!bundle) notFound()

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ProductGallery images={bundle.images} productName={bundle.name} />

        <div className="flex flex-col">
          <div className="mb-8">
            {bundle.isStarterPackage ? (
              <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                Starter Package {bundle.starterPackageCode ?? ''}
              </p>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                Bundle
              </p>
            )}
            <h1 className="mt-3 text-4xl font-light tracking-tight">{bundle.name}</h1>
            {bundle.description ? (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {bundle.description}
              </p>
            ) : null}
          </div>

          <div className="sticky top-6 space-y-6">
            <BundleAddToCart bundle={bundle} />
          </div>
        </div>
      </div>

      <div className="mt-16">
        <BundleContents bundle={bundle} />
      </div>
    </div>
  )
}
