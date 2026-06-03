/**
 * /policies/delivery
 *
 * Admin-editable via /admin/content/site/policies_delivery. Falls back to
 * POLICIES_DELIVERY_DEFAULTS if the DB row is missing or malformed.
 */

import { getSection } from '@/lib/content/site'

export const metadata = {
  title: 'Delivery: Loveli Luxury',
  description:
    'How long fragrances take to reach you in Kenya, by region. Tracking and rider details.',
  alternates: { canonical: '/policies/delivery' },
}

export default async function DeliveryPolicy() {
  const content = await getSection('policies_delivery')
  return (
    <>
      <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
        {content.lead}
      </h2>

      <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        {content.intro}
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        {content.zonesHeading}
      </h3>
      <div className="mt-4 overflow-hidden rounded-lg border border-[hsl(var(--border))]/60">
        <table className="min-w-full divide-y divide-[hsl(var(--border))]/40 text-sm">
          <thead className="bg-[hsl(var(--muted))]/40 text-left text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-5 py-3">{content.zonesHeaderLeft}</th>
              <th className="px-5 py-3">{content.zonesHeaderRight}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]/30">
            {content.zones.map((z) => (
              <tr key={z.label}>
                <td className="px-5 py-3 text-[hsl(var(--foreground))]">{z.label}</td>
                <td className="px-5 py-3 text-[hsl(var(--muted-foreground))]">{z.window}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
