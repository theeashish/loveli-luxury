'use client'

/**
 * Site footer. Hidden on /account/* dashboards (those are working surfaces,
 * not browse surfaces — the marketing footer is clutter there for
 * distributors/admins). Visible on /shop, /bundles, /, /login, /signup,
 * /partners/signup, etc.
 *
 * Content (brand intro, tagline, copyright line, closing tagline) is admin-
 * editable via `/admin/content/site/footer`. The parent layout fetches the
 * content server-side and passes it in as `copy`. Link structure stays in
 * code because each link ties to a real route.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  buildConciergeLink,
  buildConciergeMessage,
} from '@/lib/concierge/link'
import { type FooterContent } from '@/lib/content/site'

export function PublicFooter({ copy }: { copy: FooterContent }) {
  const pathname = usePathname()

  if (pathname.startsWith('/account/')) return null

  const concierge = buildConciergeLink(
    process.env.NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER ?? null,
    buildConciergeMessage({ pathname: pathname || '/' }),
  )

  return (
    <footer className="border-t border-[hsl(var(--border))]/60 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-7xl px-6 py-14 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="font-serif text-2xl text-[hsl(var(--foreground))]">
              {copy.brandName}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed">
              {copy.tagline}
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-eyebrow">Shop</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link className="hover:text-[hsl(var(--primary))]" href="/shop">
                  All fragrances
                </Link>
              </li>
              <li>
                <Link className="hover:text-[hsl(var(--primary))]" href="/bundles">
                  Bundles
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/partners"
                >
                  Partner program
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/ids"
                >
                  Income disclosure
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="text-eyebrow">Brand</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link className="hover:text-[hsl(var(--primary))]" href="/story">
                  Our story
                </Link>
              </li>
              <li>
                <Link className="hover:text-[hsl(var(--primary))]" href="/#faq">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <p className="text-eyebrow">Promise</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/policies/authenticity"
                >
                  Authenticity
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/policies/delivery"
                >
                  Delivery
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/policies/refund"
                >
                  Refunds
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--primary))]"
                  href="/track"
                >
                  Track an order
                </Link>
              </li>
              {concierge ? (
                <li>
                  <a
                    href={concierge}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[hsl(var(--primary))]"
                  >
                    Concierge (WhatsApp)
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[hsl(var(--border))]/60 pt-8 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} {copy.copyrightName}</p>
          <p>{copy.closingLine}</p>
        </div>
      </div>
    </footer>
  )
}
