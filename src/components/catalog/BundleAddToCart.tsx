'use client'

import { AddToCartButton } from './AddToCartButton'
import { imageUrl } from '@/lib/catalog/storage'
import type { BundleDto } from '@/lib/catalog/types'

export function BundleAddToCart({ bundle }: { bundle: BundleDto }) {
  const primary = bundle.images.find((i) => i.isPrimary) ?? bundle.images[0] ?? null

  return (
    <AddToCartButton
      line={{
        kind: 'bundle',
        bundleId: bundle.id,
        slug: bundle.slug,
        name: bundle.name,
        unitPriceMinor: bundle.retailPriceMinor,
        image: primary ? imageUrl(primary.storagePrefix, 'thumb') : null,
        alaCarteTotalMinor: bundle.alaCarteTotalMinor,
      }}
      disabled={!bundle.isActive}
    />
  )
}
