import { listBundles } from '@/lib/catalog/queries'
import { BundleHighlight } from '@/components/catalog/BundleHighlight'
import { EditorialPageHeader } from '@/components/editorial/EditorialPageHeader'
import { getSection } from '@/lib/content/site'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Curated Sets | Loveli Luxury Scents',
  description: 'Thoughtfully paired fragrance sets and starter packages from Loveli Luxury.',
  alternates: { canonical: '/bundles' },
}

export default async function BundlesIndexPage() {
  const [bundles, content] = await Promise.all([
    listBundles(),
    getSection('bundles_landing'),
  ])
  const countLine =
    bundles.length === 0
      ? content.emptyMessage
      : `${bundles.length} ${bundles.length === 1 ? content.countSingular : content.countPlural}`

  return (
    <div>
      <EditorialPageHeader
        eyebrow={content.eyebrow}
        title={content.headline}
        description={content.subhead}
        detail={countLine}
      />

      <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
        {bundles.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:gap-10">
            {bundles.map((bundle) => (
              <BundleHighlight key={bundle.id} bundle={bundle} />
            ))}
          </div>
        ) : (
          <div className="border-y border-[hsl(var(--border))] py-16 text-center">
            <p className="font-serif text-3xl italic text-[hsl(var(--foreground))]">{content.emptyMessage}</p>
          </div>
        )}
      </section>
    </div>
  )
}
