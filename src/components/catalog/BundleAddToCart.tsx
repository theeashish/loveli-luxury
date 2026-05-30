'use client'

import { AddToCartButton } from './AddToCartButton'
import { imageUrl } from '@/lib/catalog/storage'
import type { BundleDto } from '@/lib/catalog/types'

export function BundleAddToCart({ bundle }: { bundle: BundleDto }) {
  const primary = bundle.images.find((i) => i.isPrimary) ?? bundle.images[0] ?? null

  // Snapshot the bundle's contents at add-time so the cart can render the
  // breakdown without re-fetching. We deliberately store only display-safe
  // fields (no IDs, no prices) — the bundle row remains the source of truth
  // for what's actually shipped.
  const contents = bundle.items.map((it) => ({
    name: it.productName,
    sizeMl: it.sizeMl,
    qty: it.quantity,
  }))

  return (
    <AddToCartButton
      line={{
        kind: 'bundle',
        bundleId: bundle.id,
        slug: bundle.slug,
        name: bundle.name,
        unitPriceMinor: String(bundle.retailPriceMinor),
        image: primary ? imageUrl(primary.storagePrefix, 'thumb') : null,
        alaCarteTotalMinor: bundle.alaCarteTotalMinor === null ? null : String(bundle.alaCarteTotalMinor),
        contents,
      }}
      disabled={!bundle.isActive}
    />
  )
}
