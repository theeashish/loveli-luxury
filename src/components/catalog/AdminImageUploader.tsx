'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'sonner'

import {
  deleteBundleImage,
  deleteProductImage,
  updateBundleImage,
  updateProductImage,
  uploadBundleImage,
  uploadProductImage,
} from '@/lib/catalog/mutations'
import { imageUrl } from '@/lib/catalog/storage'
import type { ImageDto } from '@/lib/catalog/types'

type Scope = 'product' | 'bundle'

const ACCEPT = 'image/jpeg,image/png,image/webp'

const ACTIONS = {
  product: {
    upload: uploadProductImage,
    update: updateProductImage,
    remove: deleteProductImage,
    formKey: 'productId',
  },
  bundle: {
    upload: uploadBundleImage,
    update: updateBundleImage,
    remove: deleteBundleImage,
    formKey: 'bundleId',
  },
} as const

export function AdminImageUploader({
  scope,
  parentId,
  images,
}: {
  scope: Scope
  parentId: number
  images: ImageDto[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions = ACTIONS[scope]

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error(`Unsupported type: ${file.type || 'unknown'}`)
      return
    }
    const fd = new FormData()
    fd.set(actions.formKey, String(parentId))
    fd.set('file', file)
    startTransition(async () => {
      try {
        await actions.upload(fd)
        toast.success('Image uploaded')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      }
    })
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-medium">Images</h2>
          <p className="text-sm text-neutral-500">
            JPEG, PNG, or WebP. Up to 8 MB. The first image becomes the primary automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {isPending ? 'Uploading…' : 'Upload image'}
        </button>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
      />

      <div className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            onPickFiles(e.dataTransfer.files)
          }}
          className={`mb-5 rounded-lg border-2 border-dashed px-6 py-8 text-center text-sm transition ${
            dragOver
              ? 'border-neutral-900 bg-neutral-50 text-neutral-900'
              : 'border-neutral-200 text-neutral-500'
          }`}
        >
          Drag &amp; drop an image here, or click <strong>Upload image</strong> above.
        </div>

        {images.length === 0 ? (
          <p className="text-sm text-neutral-500">No images yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-4">
            {images.map((img) => (
              <ImageTile
                key={img.id}
                image={img}
                disabled={isPending}
                updateAction={actions.update}
                deleteAction={actions.remove}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ImageTile({
  image,
  disabled,
  updateAction,
  deleteAction,
}: {
  image: ImageDto
  disabled: boolean
  updateAction: (typeof ACTIONS)['product']['update']
  deleteAction: (typeof ACTIONS)['product']['remove']
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const setPrimary = () => {
    if (image.isPrimary) return
    startTransition(async () => {
      try {
        await updateAction({ id: image.id, isPrimary: true })
        toast.success('Primary image updated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed')
      }
    })
  }

  const remove = () => {
    if (!confirm('Delete this image?')) return
    startTransition(async () => {
      try {
        await deleteAction(image.id)
        toast.success('Image deleted')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  return (
    <li className="overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
      <div className="relative aspect-square">
        <Image
          src={imageUrl(image.storagePrefix, 'thumb')}
          alt={image.alt ?? ''}
          fill
          sizes="(max-width: 768px) 33vw, 200px"
          className="object-cover"
        />
        {image.isPrimary ? (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
            Primary
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={setPrimary}
          disabled={disabled || image.isPrimary}
          className="text-neutral-700 hover:text-neutral-900 disabled:cursor-default disabled:text-neutral-400"
        >
          {image.isPrimary ? 'Primary' : 'Make primary'}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={disabled}
          className="text-red-700 hover:text-red-900 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </li>
  )
}
