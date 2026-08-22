import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { Toaster } from '@/lib/toast'
import { CartIndicator } from '@/components/cart/CartIndicator'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { CartHydrator } from '@/components/cart/CartHydrator'
import { HeaderAuth } from '@/components/header/HeaderAuth'
import { MobileMenu } from '@/components/header/MobileMenu'
import { PublicFooter } from '@/components/footer/PublicFooter'
import { getSection } from '@/lib/content/site'
import { PublicDeferredWidgets } from '@/components/public/PublicDeferredWidgets'

const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/story', label: 'Story' },
  { href: '/#faq', label: 'FAQ' },
] as const

const SECONDARY_NAV = [
  { href: '/partners', label: 'Partners' },
] as const

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const footerCopy = await getSection('footer')
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--brand-gold))]/30 bg-[hsl(var(--brand-onyx))] text-[hsl(var(--brand-white))]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="group flex items-center gap-2" aria-label="Loveli Luxury Scents home">
  <Image src="/loveli-luxury-favicon.png" alt="" width={34} height={34} className="h-8 w-8 object-contain" priority />
  <Image src="/loveli-luxury-wordmark.png" alt="Loveli Luxury Scents" width={118} height={48} className="h-9 w-auto object-contain object-left md:h-10" priority />
</Link>
          <nav className="hidden items-center gap-6 text-[0.76rem] font-semibold uppercase tracking-[0.1em] md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[hsl(var(--brand-white))] transition hover:text-[hsl(var(--brand-gold))]"
              >
                {item.label}
              </Link>
            ))}
            <Suspense fallback={null}>
              <HeaderAuth variant="desktop" />
            </Suspense>
            <CartIndicator />
            <Link
              href="/partners"
              className="rounded-full border border-[hsl(var(--brand-gold))] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--brand-white))] transition hover:bg-[hsl(var(--brand-gold))] hover:text-[hsl(var(--brand-onyx))]"
            >
              Partners
            </Link>
          </nav>
          <div data-testid="mobile-header-actions" className="flex items-center gap-2 md:hidden">
            <CartIndicator />
            <MobileMenu
              nav={NAV}
              secondaryNav={SECONDARY_NAV}
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

      <PublicFooter copy={footerCopy} />

      <CartDrawer />
      <CartHydrator />
      <Toaster />
      <PublicDeferredWidgets />
    </div>
  )
}
