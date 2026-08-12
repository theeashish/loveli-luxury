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

  return (
    <article className="group relative border border-[hsl(var(--border))] bg-[hsl(var(--background))] transition duration-300 hover:-translate-y-1 hover:border-[hsl(var(--primary))]/60 hover:shadow-[0_22px_46px_-34px_hsl(var(--foreground)/0.65)]">
      <Link href={`/p/${product.slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2">
        <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(145deg,hsl(var(--muted))_0%,hsl(var(--background))_72%)]">
          {product.primaryImage ? (
            <Image
              src={imageUrl(product.primaryImage.storagePrefix, 'display')}
              alt={product.primaryImage.alt ?? product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
            />
          ) : (
            <MonogramBottle name={product.name} />
          )}
          <div className="pointer-events-none absolute inset-3 border border-[hsl(var(--primary))]/15" />
          <p className="absolute bottom-4 left-5 text-[9px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--primary))]">
            Eau de Parfum
          </p>
        </div>
        <div className="border-t border-[hsl(var(--border))]/75 p-5">
          <h3 className="font-serif text-2xl tracking-tight text-[hsl(var(--foreground))] transition group-hover:text-[hsl(var(--primary))]">
            {product.name}
          </h3>
          <p className="mt-2 text-sm tabular-nums text-[hsl(var(--muted-foreground))]">{priceLabel}</p>
        </div>
      </Link>
      <WishlistButton productId={product.id} className="absolute right-4 top-4 z-10" />
    </article>
  )
}
