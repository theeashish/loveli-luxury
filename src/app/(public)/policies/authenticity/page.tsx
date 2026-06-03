/**
 * /policies/authenticity
 *
 * Admin-editable via /admin/content/site/policies_authenticity. Falls back to
 * POLICIES_AUTHENTICITY_DEFAULTS if the DB row is missing or malformed.
 */

import { getSection } from '@/lib/content/site'

export const metadata = {
  title: 'Authenticity: Loveli Luxury',
  description:
    'Every fragrance is authenticity verified before dispatch. How we source, store, and seal each bottle.',
  alternates: { canonical: '/policies/authenticity' },
}

export default async function AuthenticityPolicy() {
  const content = await getSection('policies_authenticity')
  return (
    <>
      <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
        {content.lead}
      </h2>

      <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        {content.intro}
      </p>

      {content.sections.map((section, i) => (
        <section key={section.title}>
          <h3 className={`${i === 0 ? 'mt-12' : 'mt-10'} font-serif text-2xl italic text-[hsl(var(--foreground))]`}>
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
