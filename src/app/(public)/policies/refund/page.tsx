import { getSection } from '@/lib/content/site'
import { PolicyLead, PolicySection } from '@/components/editorial/PolicyContent'

export const metadata = {
  title: 'Returns & Refunds | Loveli Luxury Scents',
  description:
    'Clear guidance on returns, replacement support, and M-Pesa refunds for Loveli Luxury orders.',
  alternates: { canonical: '/policies/refund' },
}

export default async function RefundPolicy() {
  const content = await getSection('policies_refund')

  return (
    <>
      <PolicyLead lead={content.lead} intro={content.intro} />
      <section className="border-b border-[hsl(var(--border))] py-10 md:py-12">
        <div className="grid gap-4 md:grid-cols-[3.75rem_minmax(0,1fr)] md:gap-7">
          <p className="pt-1 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">01</p>
          <div>
            <p className="text-eyebrow">Before you begin</p>
            <h3 className="mt-3 font-serif text-3xl leading-tight italic tracking-tight text-[hsl(var(--foreground))] md:text-4xl">
              {content.qualifiesHeading}
            </h3>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
              {content.qualifiesIntro}
            </p>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {content.qualifies.map((qualification, index) => (
                <li
                  key={qualification}
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/35 p-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]"
                >
                  <span className="mr-3 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {qualification}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <div>
        {content.sections.map((section, index) => (
          <PolicySection key={`${section.title}-${index}`} index={index + 1} section={section} />
        ))}
      </div>
    </>
  )
}
