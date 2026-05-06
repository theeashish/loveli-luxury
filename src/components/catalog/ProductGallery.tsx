'use client'

import { useState } from 'react'
import Image from 'next/image'
import { imageUrl } from '@/lib/catalog/storage'
import type { ImageDto } from '@/lib/catalog/types'

export function ProductGallery({
  images,
  productName,
}: {
  images: ImageDto[]
  productName: string
}) {
  const [activeIdx, setActiveIdx] = useState(() => {
    const primaryIdx = images.findIndex((i) => i.isPrimary)
    return primaryIdx >= 0 ? primaryIdx : 0
  })

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
        No image
      </div>
    )
  }

  const active = images[activeIdx] ?? images[0]
  if (!active) return null

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <Image
          key={active.id}
          src={imageUrl(active.storagePrefix, 'display')}
          alt={active.alt ?? productName}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === activeIdx}
              className={`relative aspect-square overflow-hidden rounded border transition ${
                i === activeIdx
                  ? 'border-[hsl(var(--primary))]'
                  : 'border-[hsl(var(--border))] opacity-70 hover:opacity-100'
              }`}
            >
              <Image
                src={imageUrl(img.storagePrefix, 'thumb')}
                alt=""
                fill
                sizes="100px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
