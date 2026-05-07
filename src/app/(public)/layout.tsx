import Link from 'next/link'
import { Toaster } from 'sonner'
import { CartIndicator } from '@/components/cart/CartIndicator'
import { CartDrawer } from '@/components/cart/CartDrawer'

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
              href="/bundles"
              className="rounded-full border border-[hsl(var(--primary))] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
            >
              Join Boss Scents
            </Link>
            <CartIndicator />
          </nav>
          <div className="md:hidden">
            <CartIndicator />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[hsl(var(--border))]/60 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-7xl px-6 py-14 text-sm text-[hsl(var(--muted-foreground))]">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="font-serif text-2xl text-[hsl(var(--foreground))]">Loveli Luxury Scents</p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed">
                Hand-crafted Eau de Parfum from Nairobi. Quietly distinctive, generously
                long-wearing, made to be remembered.
              </p>
            </div>
            <div>
              <p className="text-eyebrow">Shop</p>
              <ul className="mt-4 space-y-2">
                <li><Link className="hover:text-[hsl(var(--primary))]" href="/shop">All fragrances</Link></li>
                <li><Link className="hover:text-[hsl(var(--primary))]" href="/bundles">Bundles</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-eyebrow">Company</p>
              <ul className="mt-4 space-y-2">
                <li><Link className="hover:text-[hsl(var(--primary))]" href="/#story">Our story</Link></li>
                <li><Link className="hover:text-[hsl(var(--primary))]" href="/#faq">FAQ</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[hsl(var(--border))]/60 pt-8 text-xs sm:flex-row">
            <p>© {new Date().getFullYear()} Loveli Luxury International</p>
            <p>Hand-crafted in Nairobi · Shipped with intention</p>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <Toaster richColors position="top-right" theme="dark" />
    </div>
  )
}
