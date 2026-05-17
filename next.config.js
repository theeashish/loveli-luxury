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

  experimental: {
    serverActions: {
      // Catalog image uploads cap at 8 MB (see image-pipeline.ts MAX_FILE_BYTES).
      // Keep this in sync if that limit moves.
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
