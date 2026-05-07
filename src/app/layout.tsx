import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'
import { publicEnv } from '@/lib/env'
import './globals.css'

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: 'Loveli Luxury Scents — Where Love Meets Luxury',
    template: '%s | Loveli Luxury Scents',
  },
  description:
    'Discover Loveli Luxury Scents. Hand-crafted Eau de Parfum, bottled with intention. Free delivery in Nairobi on orders above Kes 5,000.',
  applicationName: publicEnv.NEXT_PUBLIC_APP_NAME,
  authors: [{ name: 'Loveli Luxury International' }],
  generator: 'Next.js',
  keywords: ['perfume', 'luxury fragrance', 'eau de parfum', 'Kenya', 'Nairobi'],
  referrer: 'strict-origin-when-cross-origin',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: publicEnv.NEXT_PUBLIC_APP_URL,
    siteName: 'Loveli Luxury Scents',
    title: 'Loveli Luxury Scents — Where Love Meets Luxury',
    description: 'Hand-crafted Eau de Parfum, bottled with intention.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Loveli Luxury Scents',
    description: 'Hand-crafted Eau de Parfum, bottled with intention.',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0706',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
