import Link from 'next/link'
import { Toaster } from 'sonner'
import { CartIndicator } from '@/components/cart/CartIndicator'
import { CartDrawer } from '@/components/cart/CartDrawer'

const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/bundles', label: 'Bundles' },
  { href: '/about', label: 'Story' },
] as const

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
            Loveli Luxury
          </Link>
          <nav className="flex items-center gap-8 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
              >
                {item.label}
              </Link>
            ))}
            <CartIndicator />
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-[hsl(var(--muted-foreground))]">
          <div className="flex items-center justify-between">
            <p>© {new Date().getFullYear()} Loveli Luxury International</p>
            <p>Hand-crafted in Nairobi</p>
          </div>
        </div>
      </footer>

      <CartDrawer />
      <Toaster richColors position="top-right" theme="dark" />
    </div>
  )
}
