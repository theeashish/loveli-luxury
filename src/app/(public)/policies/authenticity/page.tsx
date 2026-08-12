import { getSection } from '@/lib/content/site'
import { PolicyLead, PolicySection } from '@/components/editorial/PolicyContent'

export const metadata = {
  title: 'Authenticity | Loveli Luxury Scents',
  description:
    'How Loveli Luxury verifies, stores, and seals every fragrance before dispatch.',
  alternates: { canonical: '/policies/authenticity' },
}

export default async function AuthenticityPolicy() {
  const content = await getSection('policies_authenticity')

  return (
    <>
      <PolicyLead lead={content.lead} intro={content.intro} />
      <div>
        {content.sections.map((section, index) => (
          <PolicySection key={`${section.title}-${index}`} index={index} section={section} />
        ))}
      </div>
    </>
  )
}
