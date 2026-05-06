/**
 * Server-only image processing pipeline.
 *
 * Each upload produces three webp renditions inside a per-image folder:
 *   {prefix}/original.webp   re-encoded source (no resize, q88)
 *   {prefix}/display.webp    longest edge clamped to 1600 (q85)
 *   {prefix}/thumb.webp      400x400 cover crop (q80)
 *
 * Reading code resolves URLs by appending the suffix; see ./storage.ts.
 *
 * Validation order:
 *   1. validatePreSharp() — cheap header/size checks BEFORE allocating buffers
 *   2. processImage() — sharp-driven dimension + format check, then encode
 */

import 'server-only'

import sharp from 'sharp'

export {
  buildStoragePrefix,
  joinImageUrl,
  renditionPath,
  type Rendition,
} from './image-paths'

export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ALLOWED_FORMATS = ['jpeg', 'png', 'webp'] as const
export const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB
export const MAX_DIMENSION = 6000
export const DISPLAY_LONG_EDGE = 1600
export const THUMB_SIZE = 400

export type ProcessedImage = {
  original: Buffer
  display: Buffer
  thumb: Buffer
  width: number
  height: number
}

export type PipelineErrorCode =
  | 'UNSUPPORTED_MIME'
  | 'TOO_LARGE'
  | 'UNREADABLE'
  | 'UNSUPPORTED_FORMAT'
  | 'DIMENSION_TOO_LARGE'

export class ImagePipelineError extends Error {
  constructor(
    public readonly code: PipelineErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ImagePipelineError'
  }
}

export function validatePreSharp(file: { type: string; size: number }): void {
  if (!isAllowedMime(file.type)) {
    throw new ImagePipelineError(
      'UNSUPPORTED_MIME',
      `Unsupported image type: ${file.type || '(none)'}. Allowed: ${ALLOWED_MIME.join(', ')}`,
    )
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new ImagePipelineError('UNREADABLE', 'Empty or unreadable file')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImagePipelineError(
      'TOO_LARGE',
      `File exceeds the ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB limit`,
    )
  }
}

function isAllowedMime(mime: string): boolean {
  return (ALLOWED_MIME as readonly string[]).includes(mime)
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  let meta: sharp.Metadata
  try {
    meta = await sharp(input).metadata()
  } catch (err) {
    throw new ImagePipelineError(
      'UNREADABLE',
      err instanceof Error ? err.message : 'Image could not be decoded',
    )
  }

  if (!meta.width || !meta.height) {
    throw new ImagePipelineError('UNREADABLE', 'Could not read image dimensions')
  }
  if (!meta.format || !(ALLOWED_FORMATS as readonly string[]).includes(meta.format)) {
    throw new ImagePipelineError(
      'UNSUPPORTED_FORMAT',
      `Detected format ${meta.format ?? 'unknown'} is not allowed`,
    )
  }
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new ImagePipelineError(
      'DIMENSION_TOO_LARGE',
      `Image is ${meta.width}x${meta.height}; max ${MAX_DIMENSION}px on either edge`,
    )
  }

  const [original, display, thumb] = await Promise.all([
    sharp(input).rotate().webp({ quality: 88 }).toBuffer(),
    sharp(input)
      .rotate()
      .resize({
        width: DISPLAY_LONG_EDGE,
        height: DISPLAY_LONG_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(input)
      .rotate()
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer(),
  ])

  return { original, display, thumb, width: meta.width, height: meta.height }
}

