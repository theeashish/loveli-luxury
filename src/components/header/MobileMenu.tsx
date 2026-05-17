'use client'

/**
 * Mobile menu — hamburger button + slide-down panel. Renders below the
 * sticky header on mobile (md-). Closes automatically on pathname
 * change (i.e., when the user taps any link inside).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

type NavItem = { href: string; label: string }

interface Props {
  nav: readonly NavItem[]
  authSlot: React.ReactNode
}

export function MobileMenu({ nav, authSlot }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))]/60 hover:text-[hsl(var(--primary))]"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div
        id="mobile-menu-panel"
        aria-hidden={!open}
        className={`absolute inset-x-0 top-full border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] shadow-lg transition-all duration-200 ease-out md:hidden ${
          open
            ? 'visible translate-y-0 opacity-100'
            : 'pointer-events-none invisible -translate-y-2 opacity-0'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl flex-col px-6 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-3 text-sm uppercase tracking-[0.25em] text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/boss-scents"
            className="block py-3 text-sm uppercase tracking-[0.3em] text-[hsl(var(--primary))] transition hover:opacity-80"
          >
            Boss Scents
          </Link>
          <div className="mt-1 flex flex-col border-t border-[hsl(var(--border))]/40 pt-1">
            {authSlot}
          </div>
        </nav>
      </div>
    </>
  )
}
