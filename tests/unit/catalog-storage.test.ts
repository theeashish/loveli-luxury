import { describe, it, expect } from 'vitest'
import { joinImageUrl } from '../../src/lib/catalog/image-paths'

describe('joinImageUrl', () => {
  it('concatenates base + bucket path + prefix + rendition', () => {
    expect(joinImageUrl('https://abc.supabase.co', 'products/12/uuid', 'display')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/catalog/products/12/uuid/display.webp',
    )
  })

  it('strips trailing slash from base url', () => {
    expect(joinImageUrl('https://abc.supabase.co/', 'products/1/u', 'thumb')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/catalog/products/1/u/thumb.webp',
    )
  })

  it('strips leading and trailing slashes from prefix', () => {
    expect(joinImageUrl('https://abc.supabase.co', '/products/1/u/', 'original')).toBe(
      'https://abc.supabase.co/storage/v1/object/public/catalog/products/1/u/original.webp',
    )
  })

  it('renders all three renditions correctly', () => {
    const base = 'https://abc.supabase.co'
    const prefix = 'bundles/3/uuid'
    expect(joinImageUrl(base, prefix, 'original')).toMatch(/\/original\.webp$/)
    expect(joinImageUrl(base, prefix, 'display')).toMatch(/\/display\.webp$/)
    expect(joinImageUrl(base, prefix, 'thumb')).toMatch(/\/thumb\.webp$/)
  })
})
