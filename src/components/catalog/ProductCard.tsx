import Image from 'next/image'
import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { imageUrl } from '@/lib/catalog/storage'
import type { ProductSummaryDto } from '@/lib/catalog/types'

export function ProductCard({ product }: { product: ProductSummaryDto }) {
  const priceLabel = product.minRetailPriceMinor
    ? `From ${formatKes(BigInt(product.minRetailPriceMinor))}`
    : 'Coming soon'

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] transition hover:border-[hsl(var(--primary))]"
    >
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
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            No image
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-base font-medium text-[hsl(var(--foreground))]">{product.name}</h3>
        <p className="mt-1 text-sm tabular-nums text-[hsl(var(--muted-foreground))]">
          {priceLabel}
        </p>
      </div>
    </Link>
  )
}
