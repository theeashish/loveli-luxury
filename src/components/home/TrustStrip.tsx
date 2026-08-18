/**
 * Trust strip — sits directly under the hero so a first-time visitor reads
 * the four reasons to trust the store within the first scroll. Per the brand
 * brief (homepage section #2): authenticity, M-Pesa, concierge, delivery.
 *
 * Content is admin-editable via `/admin/content/site/home_trust_strip`.
 * The icon field is constrained to a whitelist (see ICON_MAP); the admin
 * form exposes those 4 choices as a dropdown.
 */

import Link from 'next/link'
import {
  ShieldCheck,
  Smartphone,
  MessageCircle,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { getSection } from '@/lib/content/site'

const ICON_MAP: Record<string, LucideIcon> = {
  'shield-check': ShieldCheck,
  smartphone: Smartphone,
  'message-circle': MessageCircle,
  truck: Truck,
}

export async function TrustStrip() {
  const content = await getSection('home_trust_strip')

  return (
    <section
      aria-label={content.ariaLabel}
      className="loveli-reveal-up border-y border-[hsl(var(--primary)/0.42)] bg-[hsl(var(--brand-onyx))] text-[hsl(var(--brand-silver))]"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 md:grid-cols-4 md:py-14">
        {content.pillars.map((p) => {
          const Icon = ICON_MAP[p.icon] ?? ShieldCheck
          const body = (
            <div className="flex items-start gap-3">
              <Icon
                className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--brand-gold))]"
                aria-hidden
                strokeWidth={1.5}
              />
              <div>
                <p className="text-sm font-medium text-[hsl(var(--brand-silver))]">
                  {p.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--brand-silver)/0.7)]">
                  {p.sub}
                </p>
              </div>
            </div>
          )
          return p.href ? (
            <Link key={p.label} href={p.href} className="transition hover:opacity-80">
              {body}
            </Link>
          ) : (
            <div key={p.label}>{body}</div>
          )
        })}
      </div>
    </section>
  )
}
