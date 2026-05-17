import Link from 'next/link'
import { Suspense } from 'react'
import { Toaster } from 'sonner'
import { CartIndicator } from '@/components/cart/CartIndicator'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { AffiliateUpgradeLink } from '@/components/header/AffiliateUpgradeLink'
import { HeaderAuth } from '@/components/header/HeaderAuth'
import { MobileMenu } from '@/components/header/MobileMenu'
import { PublicFooter } from '@/components/footer/PublicFooter'

const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/bundles', label: 'Bundles' },
  { href: '/#story', label: 'Story' },
  { href: '/#faq', label: 'FAQ' },
] as const

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--background))]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="group flex flex-col leading-none">
            <span className="font-serif text-2xl tracking-tight text-[hsl(var(--foreground))] transition group-hover:text-[hsl(var(--primary))]">
              Loveli
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
              Luxury Scents
            </span>
          </Link>
          <nav className="hidden items-center gap-9 text-xs uppercase tracking-[0.25em] md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/boss-scents"
              className="rounded-full border border-[hsl(var(--primary))] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
            >
              Boss Scents
            </Link>
            <Suspense fallback={null}>
              {/* Server component — renders nothing for signed-out
                  users, admins, or existing distributors. */}
              <AffiliateUpgradeLink />
            </Suspense>
            <Suspense fallback={null}>
              <HeaderAuth variant="desktop" />
            </Suspense>
            <CartIndicator />
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <CartIndicator />
            <MobileMenu
              nav={NAV}
              authSlot={
                <Suspense fallback={null}>
                  <HeaderAuth variant="mobile" />
                </Suspense>
              }
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <PublicFooter />

      <CartDrawer />
      <Toaster richColors position="top-right" theme="dark" />
    </div>
  )
}
