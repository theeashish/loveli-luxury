import { getSection } from '@/lib/content/site'
import { PolicyLead, PolicySection } from '@/components/editorial/PolicyContent'

export const metadata = {
  title: 'Delivery | Loveli Luxury Scents',
  description:
    'Clear delivery windows, tracking guidance, and courier support for Loveli Luxury orders.',
  alternates: { canonical: '/policies/delivery' },
}

export default async function DeliveryPolicy() {
  const content = await getSection('policies_delivery')

  return (
    <>
      <PolicyLead lead={content.lead} intro={content.intro} />
      <div className="border-b border-[hsl(var(--border))] py-10 md:py-12">
        <p className="text-eyebrow">Delivery windows</p>
        <h3 className="mt-4 font-serif text-3xl italic tracking-tight text-[hsl(var(--foreground))] md:text-4xl">
          {content.zonesHeading}
        </h3>
        <div className="mt-7 overflow-x-auto border border-[hsl(var(--border))] bg-[hsl(var(--background))]/70">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/45 text-[9px] uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="min-w-[17rem] px-5 py-4 font-medium">{content.zonesHeaderLeft}</th>
                <th className="px-5 py-4 font-medium">{content.zonesHeaderRight}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]/70">
              {content.zones.map((zone) => (
                <tr key={zone.label}>
                  <td className="px-5 py-4 leading-6 text-[hsl(var(--foreground))]">{zone.label}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-serif italic text-[hsl(var(--primary))]">{zone.window}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        {content.sections.map((section, index) => (
          <PolicySection key={`${section.title}-${index}`} index={index + 1} section={section} />
        ))}
      </div>
    </>
  )
}
