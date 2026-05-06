import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductBySlug, listActiveProductSlugs } from '@/lib/catalog/queries'
import { ProductGallery } from '@/components/catalog/ProductGallery'
import { VariantPicker } from '@/components/catalog/VariantPicker'

export const revalidate = false
export const dynamicParams = true

export async function generateStaticParams() {
  const slugs = await listActiveProductSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const product = await getProductBySlug(params.slug)
  if (!product) return { title: 'Not found' }
  return {
    title: product.metaTitle ?? product.name,
    description:
      product.metaDescription ??
      (product.description ? product.description.slice(0, 200) : undefined),
    openGraph: {
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? undefined,
      type: 'website',
    },
  }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug)
  if (!product) notFound()

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="flex flex-col">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Eau de Parfum
            </p>
            <h1 className="mt-3 text-4xl font-light tracking-tight">{product.name}</h1>
            {product.description ? (
              <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {product.description}
              </p>
            ) : null}
          </div>

          <VariantPicker product={product} />

          <ul className="mt-10 space-y-3 border-t border-[hsl(var(--border))] pt-6 text-sm text-[hsl(var(--muted-foreground))]">
            <li className="flex justify-between">
              <span>Free delivery</span>
              <span>orders above Kes 5,000 in Nairobi</span>
            </li>
            <li className="flex justify-between">
              <span>Returns</span>
              <span>14-day, unopened</span>
            </li>
            <li className="flex justify-between">
              <span>Authenticity</span>
              <span>hand-crafted in Kenya</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
