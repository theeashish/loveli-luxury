'use client'

/**
 * Mobile navigation for the public storefront. Links are grouped by intent so
 * shopping, support, and account actions remain easy to scan on small screens.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Menu, X } from 'lucide-react'

type NavItem = { href: string; label: string }

interface Props {
  nav: readonly NavItem[]
  secondaryNav: readonly NavItem[]
  authSlot: React.ReactNode
}

const linkClassName =
  'flex min-h-12 items-center justify-between border-b border-[hsl(var(--border))]/40 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary))]'

export function MobileMenu({ nav, secondaryNav, authSlot }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const closeMenu = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]/60 hover:text-[hsl(var(--primary))]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div
        id="mobile-menu-panel"
        role="dialog"
        aria-label="Mobile navigation"
        aria-hidden={!open}
        className={
          'absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] shadow-[0_18px_40px_hsl(var(--brand-onyx)/0.65)] transition-[opacity,transform,visibility] duration-200 ' +
          (open
            ? 'pointer-events-auto visible translate-y-0 opacity-100'
            : 'pointer-events-none invisible -translate-y-2 opacity-0')
        }
      >
        <div className="mx-auto max-h-[calc(100vh-5rem)] max-w-7xl overflow-y-auto px-6 pb-6 pt-3">
          <div className="border-b border-[hsl(var(--border))]/50 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--muted-foreground))]">
              Navigate Loveli Luxury
            </p>
          </div>

          <nav aria-label="Explore" className="pt-2">
            <p className="py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--primary))]">
              Explore
            </p>
            {nav.map((item) => (
              <Link key={item.href} href={item.href} onClick={closeMenu} className={linkClassName}>
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4 text-[hsl(var(--primary))]" aria-hidden="true" />
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-[hsl(var(--border))]/50 pt-2">
            <p className="py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--primary))]">
              Account
            </p>
            <div className="flex flex-col gap-1" onClick={closeMenu}>
              {authSlot}
            </div>

          <nav aria-label="Support and partnerships" className="mt-4 border-t border-[hsl(var(--border))]/50 pt-2">
            <p className="py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--primary))]">
              Support & partnerships
            </p>
            {secondaryNav.map((item) => (
              <Link key={item.href} href={item.href} onClick={closeMenu} className={linkClassName}>
                <span>{item.label}</span>
                <ChevronRight className="h-4 w-4 text-[hsl(var(--primary))]" aria-hidden="true" />
              </Link>
            ))}
          </nav>
          </div>
        </div>
      </div>
    </>
  )
}
