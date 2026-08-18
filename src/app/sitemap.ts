import type { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/env'
import { listActiveProductSlugs } from '@/lib/catalog/queries'

/**
 * /sitemap.xml
 *
 * Static public routes + every active product (/p/[slug]). The slug lister uses the service-role client, so this
 * runs fine at build time. Catalog reads are wrapped in try/catch so a DB
 * hiccup degrades to the static routes rather than failing the sitemap.
 * Revalidated hourly (and on every deploy). Brief §11.
 */
export const revalidate = 3600

const STATIC_PATHS = [
  '',
  '/shop',
  '/partners',
  '/story',
  '/track',
  '/policies',
  '/policies/authenticity',
  '/policies/delivery',
  '/policies/refund',
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}` || base,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.6,
  }))

  let productEntries: MetadataRoute.Sitemap = []
  try {
    const slugs = await listActiveProductSlugs()
    productEntries = slugs.map((slug) => ({
      url: `${base}/p/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
  } catch {
    // Catalog unavailable — ship static routes rather than 500 the sitemap.
  }
  return [...staticEntries, ...productEntries]
}
