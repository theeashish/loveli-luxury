/**
 * /account/wishlist — server-rendered list of the signed-in user's
 * saved items, hydrated with product/bundle details from the catalog.
 *
 * The page reads from the DB (RLS-bound client). The Zustand store on
 * the client is for instant UI; the canonical truth for signed-in
 * users is the wishlist_items table.
 */

import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { imageUrl } from '@/lib/catalog/storage'
import { formatKes } from '@/lib/money'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { listMyWishlist } from '@/lib/wishlist/server'

export const metadata = {
  title: 'My wishlist: Loveli Luxury',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

type ProductCard = {
  kind: 'product'
  id: number
  slug: string
  name: string
  imageStoragePrefix: string | null
  imageAlt: string | null
  priceMinor: string | null
  addedAt: number
}

type BundleCard = {
  kind: 'bundle'
  id: number
  slug: string
  name: string
  imageStoragePrefix: string | null
  imageAlt: string | null
  retailPriceMinor: string | number
  addedAt: number
}

type Card = ProductCard | BundleCard

export default async function WishlistPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?next=/account/wishlist')
  }

  const saved = await listMyWishlist()

  const productIds = saved.flatMap((i) => (i.productId != null ? [i.productId] : []))
  const bundleIds = saved.flatMap((i) => (i.bundleId != null ? [i.bundleId] : []))

  // Service-role read so inactive items still surface (so the user can
  // remove them even if a product was deactivated by admin).
  const service = createServiceClient()
  const [productsRes, bundlesRes, productImagesRes, bundleImagesRes] =
    await Promise.all([
      productIds.length
        ? service
            .from('products')
            .select('id, slug, name')
            .in('id', productIds)
        : Promise.resolve({ data: [] as Array<{ id: number; slug: string; name: string }> }),
      bundleIds.length
        ? service
            .from('bundles')
            .select('id, slug, name, retail_price_minor')
            .in('id', bundleIds)
        : Promise.resolve({
            data: [] as Array<{
              id: number
              slug: string
              name: string
              retail_price_minor: string | number
            }>,
          }),
      productIds.length
        ? service
            .from('product_images')
            .select('product_id, storage_prefix, alt, is_primary, position')
            .in('product_id', productIds)
            .order('position', { ascending: true })
        : Promise.resolve({
            data: [] as Array<{
              product_id: number
              storage_prefix: string
              alt: string | null
              is_primary: boolean
              position: number
            }>,
          }),
      bundleIds.length
        ? service
            .from('bundle_images')
            .select('bundle_id, storage_prefix, alt, is_primary, position')
            .in('bundle_id', bundleIds)
            .order('position', { ascending: true })
        : Promise.resolve({
            data: [] as Array<{
              bundle_id: number
              storage_prefix: string
              alt: string | null
              is_primary: boolean
              position: number
            }>,
          }),
    ])

  const products = (productsRes.data ?? []) as Array<{
    id: number
    slug: string
    name: string
  }>
  const bundles = (bundlesRes.data ?? []) as Array<{
    id: number
    slug: string
    name: string
    retail_price_minor: string | number
  }>
  const productImages = (productImagesRes.data ?? []) as Array<{
    product_id: number
    storage_prefix: string
    alt: string | null
    is_primary: boolean
  }>
  const bundleImages = (bundleImagesRes.data ?? []) as Array<{
    bundle_id: number
    storage_prefix: string
    alt: string | null
    is_primary: boolean
  }>

  // Min retail price per product, computed from variants. Cheap because
  // wishlists are small.
  const variantsRes = productIds.length
    ? await service
        .from('product_variants')
        .select('product_id, retail_price_minor, is_active')
        .in('product_id', productIds)
    : { data: [] as Array<{ product_id: number; retail_price_minor: string; is_active: boolean }> }
  const variants = (variantsRes.data ?? []) as Array<{
    product_id: number
    retail_price_minor: string | number
    is_active: boolean
  }>
  const minPriceByProduct = new Map<number, bigint>()
  for (const v of variants) {
    if (!v.is_active) continue
    const m = BigInt(v.retail_price_minor)
    const cur = minPriceByProduct.get(v.product_id)
    if (cur === undefined || m < cur) minPriceByProduct.set(v.product_id, m)
  }

  const cards: Card[] = []
  const productImgByProduct = new Map<
    number,
    { storage_prefix: string; alt: string | null }
  >()
  for (const img of productImages) {
    const cur = productImgByProduct.get(img.product_id)
    if (!cur || img.is_primary) {
      productImgByProduct.set(img.product_id, {
        storage_prefix: img.storage_prefix,
        alt: img.alt,
      })
    }
  }
  const bundleImgByBundle = new Map<
    number,
    { storage_prefix: string; alt: string | null }
  >()
  for (const img of bundleImages) {
    const cur = bundleImgByBundle.get(img.bundle_id)
    if (!cur || img.is_primary) {
      bundleImgByBundle.set(img.bundle_id, {
        storage_prefix: img.storage_prefix,
        alt: img.alt,
      })
    }
  }
  const productById = new Map(products.map((p) => [p.id, p]))
  const bundleById = new Map(bundles.map((b) => [b.id, b]))

  for (const s of saved) {
    if (s.productId != null) {
      const p = productById.get(s.productId)
      if (!p) continue
      const img = productImgByProduct.get(p.id) ?? null
      const min = minPriceByProduct.get(p.id)
      cards.push({
        kind: 'product',
        id: p.id,
        slug: p.slug,
        name: p.name,
        imageStoragePrefix: img?.storage_prefix ?? null,
        imageAlt: img?.alt ?? null,
        priceMinor: min !== undefined ? min.toString() : null,
        addedAt: s.addedAt,
      })
    } else if (s.bundleId != null) {
      const b = bundleById.get(s.bundleId)
      if (!b) continue
      const img = bundleImgByBundle.get(b.id) ?? null
      cards.push({
        kind: 'bundle',
        id: b.id,
        slug: b.slug,
        name: b.name,
        imageStoragePrefix: img?.storage_prefix ?? null,
        imageAlt: img?.alt ?? null,
        retailPriceMinor: b.retail_price_minor,
        addedAt: s.addedAt,
      })
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <header className="mb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
          Your shortlist
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
          Saved for later
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          The fragrances and bundles you've earmarked. Pick one to revisit, or
          remove a save with the heart.
        </p>
      </header>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--muted))]/30 p-10 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            You haven't saved anything yet.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-block rounded-md border border-[hsl(var(--primary))]/40 px-6 py-3 text-xs uppercase tracking-[0.2em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <article
              key={`${card.kind}-${card.id}`}
              className="group relative overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] transition hover:border-[hsl(var(--primary))]"
            >
              <Link
                href={
                  card.kind === 'product'
                    ? `/p/${card.slug}`
                    : `/bundles/${card.slug}`
                }
                className="block"
              >
                <div className="relative aspect-square bg-[hsl(var(--background))]">
                  {card.imageStoragePrefix ? (
                    <Image
                      src={imageUrl(card.imageStoragePrefix, 'display')}
                      alt={card.imageAlt ?? card.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
                    {card.kind === 'product' ? 'Fragrance' : 'Bundle'}
                  </p>
                  <h3 className="mt-1 text-base font-medium text-[hsl(var(--foreground))]">
                    {card.name}
                  </h3>
                  <p className="mt-1 text-sm tabular-nums text-[hsl(var(--muted-foreground))]">
                    {card.kind === 'product'
                      ? card.priceMinor
                        ? `From ${formatKes(BigInt(card.priceMinor))}`
                        : 'Coming soon'
                      : formatKes(BigInt(card.retailPriceMinor))}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]/80">
                    Saved {new Date(card.addedAt).toLocaleDateString('en-KE', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </Link>
              <WishlistButton
                {...(card.kind === 'product'
                  ? { productId: card.id }
                  : { bundleId: card.id })}
                className="absolute right-3 top-3 z-10"
              />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
