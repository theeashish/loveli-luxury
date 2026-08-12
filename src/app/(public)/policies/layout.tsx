import Link from 'next/link'
import { getSection } from '@/lib/content/site'
import { EditorialPageHeader } from '@/components/editorial/EditorialPageHeader'

export default async function PoliciesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const content = await getSection('policies_shell')
  const policyLinks = [
    { href: '/policies/authenticity', label: content.authenticityLabel, number: '01' },
    { href: '/policies/delivery', label: content.deliveryLabel, number: '02' },
    { href: '/policies/refund', label: content.refundLabel, number: '03' },
  ]

  return (
    <div>
      <EditorialPageHeader
        eyebrow={content.eyebrow}
        title={content.headline}
        description={content.subhead}
        detail={content.lastUpdated}
      />

      <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-24">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border-y border-[hsl(var(--border))] py-6">
              <p className="text-eyebrow">{content.sectionsLabel}</p>
              <nav aria-label={content.sectionsLabel} className="mt-5">
                <ol className="space-y-1">
                  {policyLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="group flex items-center justify-between gap-4 py-3 text-sm text-[hsl(var(--foreground))] transition hover:text-[hsl(var(--primary))]"
                      >
                        <span>{link.label}</span>
                        <span className="text-[10px] tracking-[0.18em] text-[hsl(var(--muted-foreground))] transition group-hover:text-[hsl(var(--primary))]">
                          {link.number}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>

            <div className="mt-8 border-l border-[hsl(var(--primary))]/40 pl-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">
                {content.lastUpdatedLabel}
              </p>
              <p className="mt-2 font-serif text-lg italic text-[hsl(var(--foreground))]">
                {content.lastUpdated}
              </p>
            </div>
          </aside>

          <article className="min-w-0">{children}</article>
        </div>
      </div>
    </div>
  )
}
