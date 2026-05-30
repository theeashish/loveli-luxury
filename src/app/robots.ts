import type { MetadataRoute } from 'next'
import { publicEnv } from '@/lib/env'

/**
 * /robots.txt
 *
 * Allow crawling of the public storefront; block private (admin, account),
 * transactional (checkout, cart), and machine (api, auth) areas. Points
 * crawlers at the sitemap. Brief §11.
 */
export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/account',
        '/api',
        '/checkout',
        '/cart',
        '/auth',
        '/post-login',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
