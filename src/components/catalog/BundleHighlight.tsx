import Image from 'next/image'
import Link from 'next/link'
import { formatKes } from '@/lib/money'
import { imageUrl } from '@/lib/catalog/storage'
import type { BundleDto } from '@/lib/catalog/types'

export function BundleHighlight({ bundle }: { bundle: BundleDto }) {
  const primary = bundle.images.find((i) => i.isPrimary) ?? bundle.images[0] ?? null
  const retail = BigInt(bundle.retailPriceMinor)
  const ala = BigInt(bundle.alaCarteTotalMinor)
  const savings = ala > retail ? ala - retail : 0n

  return (
    <Link
      href={`/bundles/${bundle.slug}`}
      className="group flex overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] transition hover:border-[hsl(var(--primary))]"
    >
      <div className="relative aspect-square w-2/5 shrink-0 bg-[hsl(var(--background))]">
        {primary ? (
          <Image
            src={imageUrl(primary.storagePrefix, 'display')}
            alt={primary.alt ?? bundle.name}
            fill
            sizes="(max-width: 768px) 50vw, 240px"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          {bundle.starterPackageCode ? (
            <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Package {bundle.starterPackageCode}
            </p>
          ) : null}
          <h3 className="mt-2 text-xl font-light">{bundle.name}</h3>
          {bundle.description ? (
            <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
              {bundle.description}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex items-baseline gap-3">
          <p className="text-2xl font-light tabular-nums">{formatKes(retail)}</p>
          {savings > 0n ? (
            <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--accent))]">
              Save {formatKes(savings)}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
