import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  buildStoragePrefix,
  ImagePipelineError,
  MAX_DIMENSION,
  MAX_FILE_BYTES,
  processImage,
  renditionPath,
  validatePreSharp,
} from '../../src/lib/catalog/image-pipeline'

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
}

describe('validatePreSharp', () => {
  it('accepts allowed mimes within size limit', () => {
    expect(() => validatePreSharp({ type: 'image/jpeg', size: 1000 })).not.toThrow()
    expect(() => validatePreSharp({ type: 'image/png', size: 1000 })).not.toThrow()
    expect(() => validatePreSharp({ type: 'image/webp', size: 1000 })).not.toThrow()
  })

  it('rejects unsupported mime', () => {
    expect(() => validatePreSharp({ type: 'image/gif', size: 1000 })).toThrow(ImagePipelineError)
    expect(() => validatePreSharp({ type: '', size: 1000 })).toThrow(ImagePipelineError)
  })

  it('rejects empty / NaN size', () => {
    expect(() => validatePreSharp({ type: 'image/jpeg', size: 0 })).toThrow(ImagePipelineError)
    expect(() => validatePreSharp({ type: 'image/jpeg', size: Number.NaN })).toThrow(
      ImagePipelineError,
    )
  })

  it('rejects files larger than MAX_FILE_BYTES', () => {
    expect(() =>
      validatePreSharp({ type: 'image/jpeg', size: MAX_FILE_BYTES + 1 }),
    ).toThrow(ImagePipelineError)
  })
})

describe('processImage', () => {
  it('produces three webp renditions with correct dimensions', async () => {
    const input = await makeJpeg(2400, 1600)
    const out = await processImage(input)

    expect(out.width).toBe(2400)
    expect(out.height).toBe(1600)

    const originalMeta = await sharp(out.original).metadata()
    expect(originalMeta.format).toBe('webp')
    expect(originalMeta.width).toBe(2400)

    const displayMeta = await sharp(out.display).metadata()
    expect(displayMeta.format).toBe('webp')
    expect(displayMeta.width).toBe(1600) // longest edge clamped
    expect(displayMeta.height).toBeLessThanOrEqual(1600)

    const thumbMeta = await sharp(out.thumb).metadata()
    expect(thumbMeta.format).toBe('webp')
    expect(thumbMeta.width).toBe(400)
    expect(thumbMeta.height).toBe(400)
  })

  it('does not enlarge a small input on display rendition', async () => {
    const input = await makeJpeg(800, 600)
    const out = await processImage(input)
    const display = await sharp(out.display).metadata()
    expect(display.width).toBe(800)
    expect(display.height).toBe(600)
  })

  it('crops a portrait input to a square thumb (cover)', async () => {
    const input = await makeJpeg(800, 1200)
    const out = await processImage(input)
    const thumb = await sharp(out.thumb).metadata()
    expect(thumb.width).toBe(400)
    expect(thumb.height).toBe(400)
  })

  it('rejects images over MAX_DIMENSION on either edge', async () => {
    const input = await makeJpeg(MAX_DIMENSION + 1, 100)
    await expect(processImage(input)).rejects.toMatchObject({ code: 'DIMENSION_TOO_LARGE' })
  })

  it('rejects undecodable input', async () => {
    const garbage = Buffer.from('not actually an image, this is plain text')
    await expect(processImage(garbage)).rejects.toMatchObject({ code: 'UNREADABLE' })
  })

  it('produces strictly smaller display than original byte size for typical photos', async () => {
    const input = await makeJpeg(3000, 2000)
    const out = await processImage(input)
    expect(out.display.byteLength).toBeLessThan(out.original.byteLength)
  })
})

describe('buildStoragePrefix / renditionPath', () => {
  it('namespaces by scope and id', () => {
    expect(buildStoragePrefix('products', 12, 'abc-123')).toBe('products/12/abc-123')
    expect(buildStoragePrefix('bundles', 7, 'uuid')).toBe('bundles/7/uuid')
  })

  it('appends rendition suffixes', () => {
    expect(renditionPath('products/1/u', 'original')).toBe('products/1/u/original.webp')
    expect(renditionPath('products/1/u', 'display')).toBe('products/1/u/display.webp')
    expect(renditionPath('products/1/u', 'thumb')).toBe('products/1/u/thumb.webp')
  })
})
