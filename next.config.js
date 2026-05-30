const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https://*.supabase.co https://www.facebook.com https://www.google-analytics.com;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://backend.payhero.co.ke https://www.google-analytics.com https://*.sentry.io https://analytics.tiktok.com;
  frame-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim()

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy,
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Lint is run separately in CI via `npm run lint`. We don't want
  // cosmetic ESLint rules (e.g. react/no-unescaped-entities) to block
  // production builds — the rules-of-hooks violation that mattered is
  // fixed in the source.
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    // Mobile-first Kenyan 4G audience — narrow the device-size matrix so
    // the optimizer doesn't generate (and the CDN doesn't cache) a long
    // tail of variants nobody loads. Defaults are 8 device sizes / 8 image
    // sizes; this is 7 / 6 covering common phone widths through laptop.
    deviceSizes: [360, 414, 480, 768, 1024, 1280, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256],
    // Static product photography rarely changes. Cache at the edge for a
    // year so repeat visitors hit the CDN, not the origin.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // 301 redirects for the Phase 1 (terminology refactor) slug rename:
  // /distributors/* → /partners/*, /account/distributor/* → /account/partner/*,
  // /api/distributor-signup/* → /api/partner-signup/*.
  // External invite links shared on WhatsApp / Instagram / Twitter still
  // point at the old slugs — these redirects preserve them. 301 (not 302)
  // because the rename is permanent.
  async redirects() {
    return [
      { source: '/distributors/signup', destination: '/partners/signup', permanent: true },
      { source: '/distributors/:path*', destination: '/partners/:path*', permanent: true },
      { source: '/account/distributor', destination: '/account/partner', permanent: true },
      { source: '/account/distributor/:path*', destination: '/account/partner/:path*', permanent: true },
      { source: '/api/distributor-signup/:path*', destination: '/api/partner-signup/:path*', permanent: true },
      // /boss-scents comp-plan slug retired → /partners program landing.
      { source: '/boss-scents', destination: '/partners', permanent: true },
      // Partner portal sub-tab renamed off the "downline" word.
      { source: '/account/partner/downline', destination: '/account/partner/network', permanent: true },
    ]
  },

  experimental: {
    instrumentationHook: true,
    serverActions: {
      // Catalog image uploads cap at 8 MB (see image-pipeline.ts MAX_FILE_BYTES).
      // Keep this in sync if that limit moves.
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
})
