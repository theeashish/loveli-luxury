import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductBySlug, listActiveProductSlugs } from '@/lib/catalog/queries'
import { joinImageUrl } from '@/lib/catalog/image-paths'
import { publicEnv } from '@/lib/env'
import type { ImageDto } from '@/lib/catalog/types'
import { ProductGallery } from '@/components/catalog/ProductGallery'
import { VariantPicker } from '@/components/catalog/VariantPicker'
import { getPricingContext } from '@/lib/catalog/pricing-context'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { RecordRecentView } from '@/components/catalog/RecordRecentView'
import { RecentlyViewedStrip } from '@/components/catalog/RecentlyViewedStrip'
import { FragranceDetail } from '@/components/catalog/FragranceDetail'
import { SimilarProducts } from '@/components/catalog/SimilarProducts'
import { ProductReviews } from '@/components/catalog/ProductReviews'
import { buildConciergeLink, buildConciergeMessage } from '@/lib/concierge/link'
import { getFragrance } from '@/lib/catalog/fragrance-meta'

// Catalog reads use the auth-bound Supabase client (cookies()), which
// breaks static generation with DYNAMIC_SERVER_USAGE. Render fresh
// per request for now.
export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateStaticParams() {
  // Degrade to on-demand rendering when the catalog can't be read at build
  // time (e.g. CI builds with no database reachable). On Vercel, where the DB
  // is reachable, this still returns every slug and pre-renders them. Mirrors
  // the resilient pattern in app/sitemap.ts. dynamicParams defaults to true,
  // so any slug not listed here is rendered on first request (ISR).
  try {
    const slugs = await listActiveProductSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

function primaryImageUrl(images: ImageDto[], marketingImage?: string): string | undefined {
  if (marketingImage) return marketingImage
  const primary = images.find((i) => i.isPrimary) ?? images[0]
  return primary
    ? joinImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, primary.storagePrefix, 'display')
    : undefined
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const product = await getProductBySlug(params.slug)
  if (!product) return { title: 'Not found' }
  const image = primaryImageUrl(product.images, getFragrance(product.slug)?.image)
  const description =
    product.metaDescription ??
    (product.description ? product.description.slice(0, 200) : undefined)
  return {
    title: product.metaTitle ?? product.name,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? undefined,
      type: 'website',
      url: `/p/${product.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug)
  if (!product) notFound()
  const pricingContext = await getPricingContext()
  const fragrance = getFragrance(product.slug)

  // Order via WhatsApp: deep link to the concierge with product context.
  const waLink = buildConciergeLink(
    process.env.NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER ?? null,
    buildConciergeMessage({ pathname: `/p/${product.slug}`, productName: product.name }),
  )

  // ── SEO: Product + BreadcrumbList JSON-LD ───────────────────────────────
  const image = primaryImageUrl(product.images, fragrance?.image)
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  const productUrl = `${appUrl}/p/${product.slug}`
  const activeVariants = product.variants.filter((v) => v.isActive)
  const priceMinors = activeVariants
    .map((v) => Number(v.retailPriceMinor))
    .filter((n) => Number.isFinite(n) && n > 0)
  const minMinor = priceMinors.length ? Math.min(...priceMinors) : null
  const inStock = activeVariants.some((v) => v.inventoryQty > 0)

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(image ? { image: [image] } : {}),
    brand: { '@type': 'Brand', name: 'Loveli Luxury' },
    category: 'Eau de Parfum',
    ...(minMinor != null
      ? {
          offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: 'KES',
            price: (minMinor / 100).toFixed(2),
            availability: inStock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          },
        }
      : {}),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${appUrl}/shop` },
      { '@type': 'ListItem', position: 3, name: product.name, item: productUrl },
    ],
  }
  const ldJson = (obj: unknown) => JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <div className="mx-auto max-w-7xl px-6 pt-10 pb-20 md:pt-12 md:pb-16 lg:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd) }}
      />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(20rem,30rem)_minmax(0,1fr)] lg:items-start lg:gap-20">
        <ProductGallery
          images={product.images}
          productName={product.name}
          marketingImage={fragrance?.image}
          marketingAlt={fragrance ? `${fragrance.name} Eau de Parfum` : undefined}
        />

        <div className="flex flex-col lg:pt-4">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Eau de Parfum
            </p>
            <h1 className="mt-3 font-serif text-5xl font-light tracking-tight md:text-6xl">
              {product.name}
            </h1>
            {product.description ? (
              <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
                {product.description}
              </p>
            ) : null}
            {fragrance ? (
              <dl className="mt-7 grid gap-4 border-y border-[hsl(var(--border))] py-5 sm:grid-cols-3">
                <div>
                  <dt className="text-[9px] font-medium uppercase tracking-[0.24em] text-[hsl(var(--primary))]">Scent family</dt>
                  <dd className="mt-2 text-sm capitalize text-[hsl(var(--foreground))]">{fragrance.family}</dd>
                </div>
                <div>
                  <dt className="text-[9px] font-medium uppercase tracking-[0.24em] text-[hsl(var(--primary))]">Key notes</dt>
                  <dd className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">{fragrance.notes}</dd>
                </div>
                <div>
                  <dt className="text-[9px] font-medium uppercase tracking-[0.24em] text-[hsl(var(--primary))]">The feeling</dt>
                  <dd className="mt-2 text-sm leading-6 text-[hsl(var(--foreground))]">{fragrance.mood}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          <VariantPicker product={product} pricingTier={pricingContext.tier} />

          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-[hsl(var(--primary))]/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
            >
              Order via WhatsApp
            </a>
          ) : null}

          <div className="mt-4 flex">
            <WishlistButton productId={product.id} size="large" />
          </div>

          <ul className="mt-10 space-y-3 border-t border-[hsl(var(--border))] pt-6 text-sm text-[hsl(var(--muted-foreground))]">
            <li className="flex justify-between">
              <span>Free delivery</span>
              <span>orders above Kes 5,000 in Nairobi</span>
            </li>
            <li className="flex justify-between">
              <span>Returns</span>
              <span>7-day, unopened (see refund policy)</span>
            </li>
            <li className="flex justify-between">
              <span>Authenticity</span>
              <span>verified before dispatch</span>
            </li>
          </ul>
        </div>
      </div>

      <FragranceDetail meta={product.fragranceMeta} />

      <ProductReviews productId={product.id} />

      <SimilarProducts
        productId={product.id}
        scentFamily={product.fragranceMeta?.scentFamily ?? null}
      />

      <RecordRecentView productId={product.id} slug={product.slug} />
      <RecentlyViewedStrip excludeProductId={product.id} />
    </div>
  )
}
