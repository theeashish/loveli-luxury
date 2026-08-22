'use client'

/**
 * Site footer. Hidden on /account/* dashboards (those are working surfaces,
 * not browse surfaces â€” the marketing footer is clutter there for
 * distributors/admins). Visible on /shop, /bundles, /, /login, /signup,
 * /partners/signup, etc.
 *
 * Content (brand intro, tagline, copyright line, closing tagline) is admin-
 * editable via `/admin/content/site/footer`. The parent layout fetches the
 * content server-side and passes it in as `copy`. Link structure stays in
 * code because each link ties to a real route.
 */

import Image from 'next/image'
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
    <footer className="border-t border-[hsl(var(--brand-gold))]/30 bg-[hsl(var(--brand-onyx))]">
      <div className="mx-auto max-w-7xl px-6 py-14 text-sm text-[hsl(var(--brand-silver))]">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="space-y-3">
  <Image src="/loveli-luxury-wordmark.png" alt="Loveli Luxury Scents" width={170} height={68} className="h-12 w-auto object-contain object-left" />
  <p className="font-serif text-xl text-[hsl(var(--brand-white))]">{copy.brandName}</p>
</div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed">
              {copy.tagline}
            </p>
          </div>

          <div className="md:col-span-2">
            <p className="text-eyebrow text-[hsl(var(--brand-gold))]">Shop</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link className="hover:text-[hsl(var(--brand-gold))]" href="/shop">
                  All fragrances
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/partners"
                >
                  Partner program
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/ids"
                >
                  Income disclosure
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <p className="text-eyebrow text-[hsl(var(--brand-gold))]">Brand</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link className="hover:text-[hsl(var(--brand-gold))]" href="/story">
                  Our story
                </Link>
              </li>
              <li>
                <Link className="hover:text-[hsl(var(--brand-gold))]" href="/#faq">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <p className="text-eyebrow text-[hsl(var(--brand-gold))]">Promise</p>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/policies/authenticity"
                >
                  Authenticity
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/policies/delivery"
                >
                  Delivery
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/policies/refund"
                >
                  Refunds
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/policies/privacy"
                >
                  Privacy & data
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/policies/terms"
                >
                  Terms of sale
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
                  href="/policies/complaints"
                >
                  Complaints
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-[hsl(var(--brand-gold))]"
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
                    className="hover:text-[hsl(var(--brand-gold))]"
                  >
                    Concierge (WhatsApp)
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[hsl(var(--brand-gold))]/25 pt-8 text-xs sm:flex-row">
          <p><span aria-hidden="true">&copy;</span> {new Date().getFullYear()} {copy.copyrightName}</p>
          <p>{copy.closingLine}</p>
        </div>
      </div>
    </footer>
  )
}
