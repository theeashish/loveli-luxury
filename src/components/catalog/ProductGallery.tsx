'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { imageUrl } from '@/lib/catalog/storage'
import type { ImageDto } from '@/lib/catalog/types'

type GalleryImage = {
  id: string
  displaySrc: string
  thumbSrc: string
  alt: string
}

export function ProductGallery({
  images,
  productName,
  marketingImage,
  marketingAlt,
}: {
  images: ImageDto[]
  productName: string
  marketingImage?: string
  marketingAlt?: string
}) {
  const galleryImages = useMemo<GalleryImage[]>(() => {
    const catalogImages = images.map((image) => ({
      id: String(image.id),
      displaySrc: imageUrl(image.storagePrefix, 'display'),
      thumbSrc: imageUrl(image.storagePrefix, 'thumb'),
      alt: image.alt ?? productName,
    }))

    // The approved editorial photograph is the lead image whenever this
    // fragrance has a curated marketing entry. Catalog images remain useful
    // as supporting views and as the fallback for products without one.
    if (marketingImage) {
      return [
        {
          id: 'editorial',
          displaySrc: marketingImage,
          thumbSrc: marketingImage,
          alt: marketingAlt ?? productName,
        },
        ...catalogImages,
      ]
    }

    return catalogImages
  }, [images, marketingAlt, marketingImage, productName])

  const [activeIdx, setActiveIdx] = useState(0)
  const active = galleryImages[Math.min(activeIdx, Math.max(0, galleryImages.length - 1))]

  if (!active) {
    return (
      <div className="mx-auto flex aspect-[4/5] w-full max-w-[30rem] items-center justify-center border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        Image coming soon
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[30rem] space-y-3 lg:sticky lg:top-28 lg:self-start">
      <div className="relative aspect-[4/5] overflow-hidden border border-[hsl(var(--border))] bg-[linear-gradient(145deg,hsl(var(--muted))_0%,hsl(var(--background))_72%)] shadow-[0_22px_46px_-34px_hsl(var(--foreground)/0.55)]">
        <Image
          key={active.id}
          src={active.displaySrc}
          alt={active.alt}
          fill
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 34rem, 30rem"
          priority
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-3 border border-[hsl(var(--primary))]/15" />
      </div>
      {galleryImages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Product image gallery">
          {galleryImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIdx(index)}
              aria-label={`View image ${index + 1}`}
              aria-current={index === activeIdx}
              className={`relative h-16 w-14 shrink-0 overflow-hidden border transition sm:h-20 sm:w-16 ${
                index === activeIdx
                  ? 'border-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--border))] opacity-70 hover:opacity-100'
              }`}
            >
              <Image src={image.thumbSrc} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
