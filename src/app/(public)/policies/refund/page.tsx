/**
 * /policies/refund
 *
 * Admin-editable via /admin/content/site/policies_refund. Falls back to
 * POLICIES_REFUND_DEFAULTS if the DB row is missing or malformed.
 */

import { getSection } from '@/lib/content/site'

export const metadata = {
  title: 'Refunds: Loveli Luxury',
  description:
    'How refunds work at Loveli Luxury. 7-day window from delivery. Sealed bottles only. M-Pesa reversal within 5 business days.',
  alternates: { canonical: '/policies/refund' },
}

export default async function RefundPolicy() {
  const content = await getSection('policies_refund')
  return (
    <>
      <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
        {content.lead}
      </h2>

      <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        {content.intro}
      </p>

      <h3 className="mt-12 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        {content.qualifiesHeading}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        {content.qualifiesIntro}
      </p>
      <ul className="mt-3 space-y-2 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        {content.qualifies.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>

      {content.sections.map((section) => (
        <section key={section.title}>
          <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
            {section.title}
          </h3>
          {section.body ? (
            <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
              {section.body}
            </p>
          ) : null}
          {section.bullets && section.bullets.length > 0 ? (
            <ul className="mt-3 space-y-2 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  )
}
