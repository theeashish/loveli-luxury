import Image from 'next/image'
import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { imageUrl } from '@/lib/catalog/storage'
import { WishlistButton } from '@/components/wishlist/WishlistButton'
import { MonogramBottle } from '@/components/catalog/MonogramBottle'
import type { BundleDto } from '@/lib/catalog/types'

export function BundleHighlight({ bundle }: { bundle: BundleDto }) {
  const primary = bundle.images.find((image) => image.isPrimary) ?? bundle.images[0] ?? null
  const retail = BigInt(bundle.retailPriceMinor)
  const alaCarte = BigInt(bundle.alaCarteTotalMinor)
  const savings = alaCarte > retail ? alaCarte - retail : 0n

  return (
    <article className="group relative overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--background))] transition duration-300 hover:-translate-y-1 hover:border-[hsl(var(--primary))]/60 hover:shadow-[0_22px_46px_-34px_hsl(var(--foreground)/0.65)]">
      <Link
        href={`/bundles/${bundle.slug}`}
        className="grid min-h-full grid-cols-[minmax(9rem,0.8fr)_minmax(0,1.2fr)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
      >
        <div className="relative min-h-[17rem] overflow-hidden bg-[linear-gradient(145deg,hsl(var(--muted))_0%,hsl(var(--background))_72%)]">
          {primary ? (
            <Image
              src={imageUrl(primary.storagePrefix, 'display')}
              alt={primary.alt ?? bundle.name}
              fill
              sizes="(max-width: 768px) 45vw, 360px"
              className="object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
            />
          ) : (
            <MonogramBottle name={bundle.name} />
          )}
          <div className="pointer-events-none absolute inset-3 border border-[hsl(var(--primary))]/15" />
        </div>
        <div className="flex min-w-0 flex-col justify-between border-l border-[hsl(var(--border))] p-6 md:p-8">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--primary))]">
              {bundle.starterPackageCode ? `Starter package ${bundle.starterPackageCode}` : 'Curated set'}
            </p>
            <h3 className="mt-4 font-serif text-3xl leading-tight tracking-tight text-[hsl(var(--foreground))] transition group-hover:text-[hsl(var(--primary))]">
              {bundle.name}
            </h3>
            {bundle.description ? (
              <p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{bundle.description}</p>
            ) : null}
          </div>
          <div className="mt-8 border-t border-[hsl(var(--border))] pt-5">
            <p className="font-serif text-2xl tabular-nums text-[hsl(var(--foreground))]">{formatKes(retail)}</p>
            {savings > 0n ? (
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
                Save {formatKes(savings)}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
      <WishlistButton bundleId={bundle.id} className="absolute right-4 top-4 z-10" />
    </article>
  )
}
