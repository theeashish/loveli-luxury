'use client'

/**
 * Site footer. Hidden on /account/* dashboards (those are working
 * surfaces, not browse surfaces — the marketing footer is clutter there
 * for distributors/admins). Visible on /shop, /bundles, /, /login,
 * /signup, /distributors/signup, etc.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function PublicFooter() {
  const pathname = usePathname()

  if (pathname.startsWith('/account/')) return null

  return (
    <footer className="border-t border-[hsl(var(--border))]/60 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-7xl px-6 py-14 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-serif text-2xl text-[hsl(var(--foreground))]">
              Loveli Luxury Scents
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed">
              Hand-crafted Eau de Parfum from Nairobi. Quietly distinctive,
              generously long-wearing, made to be remembered.
            </p>
          </div>
          <div>
            <p className="text-eyebrow">Shop</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/shop"
                >
                  All fragrances
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/bundles"
                >
                  Bundles
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-eyebrow">Company</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/#story"
                >
                  Our story
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/#faq"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[hsl(var(--border))]/60 pt-8 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} Loveli Luxury International</p>
          <p>Hand-crafted in Nairobi · Shipped with intention</p>
        </div>
      </div>
    </footer>
  )
}
