'use client'

/**
 * WhatsAppConcierge — floating CTA, bottom-right, on every public page.
 *
 * Reads NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER from env. When the env is
 * unset, renders nothing (safe degrade — the rest of the layout still
 * works). When set, renders a small WhatsApp glyph button that opens
 * wa.me in a new tab with a path-aware prefilled message.
 *
 * Restraint principles per the brand brief:
 *   - One button, one CTA, one colour. No pulse-loop overload.
 *   - Subtle border + soft shadow. No glowing gradient. No oversized
 *     "CHAT WITH US" label — wordless on desktop, single-word "Concierge"
 *     label on hover only.
 *   - aria-label is verbose so screen-readers + crawlers know it's a
 *     real concierge surface, not a chatbot.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  buildConciergeLink,
  buildConciergeMessage,
} from '@/lib/concierge/link'

export function WhatsAppConcierge() {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER ?? null

  // SSR-safe path tracking. Render with empty pathname on server, hydrate
  // on client to current location. The link is recomputed on
  // pathname change but the surrounding render stays stable so
  // there's no hydration mismatch.
  const [pathname, setPathname] = useState<string>('')
  useEffect(() => {
    setPathname(window.location.pathname)
    const handler = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  // Path-aware message; defaults to generic when pathname is empty
  // (server render).
  const href = useMemo(() => {
    const message = buildConciergeMessage({ pathname: pathname || '/' })
    return buildConciergeLink(phone, message)
  }, [phone, pathname])

  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Concierge support — chat on WhatsApp"
      className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))] text-[hsl(var(--primary))] shadow-lg shadow-black/30 transition hover:border-[hsl(var(--primary))]/60 hover:bg-[hsl(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/60 md:bottom-8 md:right-8"
    >
      <WhatsAppGlyph className="h-6 w-6" />
      <span className="pointer-events-none absolute right-[calc(100%+12px)] hidden whitespace-nowrap rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[hsl(var(--foreground))] shadow-md transition group-hover:block group-focus-visible:block">
        Concierge
      </span>
    </a>
  )
}

function WhatsAppGlyph({ className }: { className?: string }) {
  // Inline SVG — keeps the component self-contained, no asset path.
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.296-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.889-9.884a9.81 9.81 0 0 1 6.991 2.898 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.889 9.884zM20.52 3.449C18.24 1.245 15.24.038 12.045.034 5.46.034.099 5.396.096 11.987c0 2.096.547 4.142 1.588 5.945L0 24l6.214-1.628a11.99 11.99 0 0 0 5.83 1.479h.006c6.585 0 11.946-5.362 11.949-11.951.001-3.196-1.244-6.196-3.447-8.451z" />
    </svg>
  )
}
