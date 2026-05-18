/**
 * Shared chrome for /policies/*.
 *
 * Renders an editorial layout with a left rail listing the three
 * policies + a "last updated" stamp shared by all three pages. The
 * actual policy body comes from the per-route page.tsx.
 *
 * Restraint: no breadcrumbs, no busy sidebar nav. Single small section
 * label + three links. Whitespace as primary layout tool.
 */

import Link from 'next/link'

const POLICY_LINKS = [
  { href: '/policies/authenticity', label: 'Authenticity' },
  { href: '/policies/delivery',     label: 'Delivery' },
  { href: '/policies/refund',       label: 'Refund' },
] as const

// Last-meaningful-edit date for all three policies. Bump when copy
// changes (small operational discipline; not auto-derived from file
// mtime because the build process touches files).
export const POLICIES_LAST_UPDATED = '18 May 2026'

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <header className="mb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
          Our promise
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
          Policies
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          The reassurance you need before a bottle leaves us — what we send,
          how it travels, and what happens if it lands wrong.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-[14rem_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Sections
          </p>
          <ul className="flex flex-col gap-1.5">
            {POLICY_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block py-1 text-sm text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Last updated
          </p>
          <p className="mt-1 text-sm text-[hsl(var(--foreground))]">
            {POLICIES_LAST_UPDATED}
          </p>
        </aside>

        <article className="prose prose-invert max-w-none">{children}</article>
      </div>
    </div>
  )
}
