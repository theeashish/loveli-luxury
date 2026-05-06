/**
 * Pure path builders for catalog imagery. No env, no server-only imports — safe
 * to load in client components, server components, and test bundles alike.
 */

export type Rendition = 'original' | 'display' | 'thumb'

const PUBLIC_BUCKET_PATH = '/storage/v1/object/public/catalog'

export function buildStoragePrefix(
  scope: 'products' | 'bundles',
  parentId: number,
  uuid: string,
): string {
  return `${scope}/${parentId}/${uuid}`
}

export function renditionPath(prefix: string, rendition: Rendition): string {
  return `${prefix}/${rendition}.webp`
}

export function joinImageUrl(
  supabaseUrl: string,
  prefix: string,
  rendition: Rendition,
): string {
  const base = supabaseUrl.replace(/\/+$/, '')
  const cleanPrefix = prefix.replace(/^\/+/, '').replace(/\/+$/, '')
  return `${base}${PUBLIC_BUCKET_PATH}/${cleanPrefix}/${rendition}.webp`
}
