/**
 * Public URL helper for the 'catalog' Storage bucket.
 *
 * The bucket is public-read (see migration 002), so we can hand out direct
 * URLs without signing. This module is client-safe — only NEXT_PUBLIC_ env
 * is read.
 */

import { publicEnv } from '../env'
import { joinImageUrl, type Rendition } from './image-paths'

/**
 * Resolve a public CDN URL for a stored image rendition.
 *
 * @param prefix  The `storage_prefix` column from product_images / bundle_images.
 * @param rendition  Which rendition to serve. Defaults to 'display'.
 */
export function imageUrl(prefix: string, rendition: Rendition = 'display'): string {
  return joinImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, prefix, rendition)
}

export type { Rendition }
