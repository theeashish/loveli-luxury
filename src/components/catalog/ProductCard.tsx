import Image from 'next/image'
import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { imageUrl } from '@/lib/catalog/storage'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { MonogramBottle } from '@/components/catalog/MonogramBottle'
import type { ProductSummaryDto } from '@/lib/catalog/types'

export function ProductCard({ product }: { product: ProductSummaryDto }) {
  const priceLabel = product.minRetailPriceMinor
    ? `From ${formatKes(BigInt(product.minRetailPriceMinor))}`
    : 'Coming soon'

  // WishlistButton lives OUTSIDE the Link to avoid nesting an interactive
  // element inside an <a>. Absolutely positioned over the image corner.
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] transition hover:border-[hsl(var(--primary))]">
      <Link href={`/p/${product.slug}`} className="block">
        <div className="relative aspect-square bg-[hsl(var(--background))]">
          {product.primaryImage ? (
            <Image
              src={imageUrl(product.primaryImage.storagePrefix, 'display')}
              alt={product.primaryImage.alt ?? product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            // Brand-safe fallback per the photography render brief —
            // no slogan text, monogram-only bottle. Replaces the
            // "No image" placeholder so missing imagery does not break
            // the visual rhythm of /shop or the homepage grid.
            <MonogramBottle name={product.name} />
          )}
        </div>
        <div className="p-5">
          <h3 className="text-base font-medium text-[hsl(var(--foreground))]">
            {product.name}
          </h3>
          <p className="mt-1 text-sm tabular-nums text-[hsl(var(--muted-foreground))]">
            {priceLabel}
          </p>
        </div>
      </Link>
      <WishlistButton
        productId={product.id}
        className="absolute right-3 top-3 z-10"
      />
    </div>
  )
}
