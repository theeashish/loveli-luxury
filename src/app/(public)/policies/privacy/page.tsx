import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy & data use | Loveli Luxury Scents',
  description: 'How Loveli Luxury International intends to collect, use, protect, retain, and respond to requests about personal information.',
}

const sections = [
  {
    "title": "What we collect",
    "body": "We collect only information needed to provide an account, deliver an order, process payment, support a customer request, prevent fraud, or meet a legal obligation. Depending on the service used, this may include contact, delivery, order, account, payment-reference, verification, and support information.",
    "bullets": [
      "Account and contact details provided by you.",
      "Delivery and order information needed to fulfil a purchase.",
      "Payment references and status information from approved payment providers; Loveli Luxury should not store card security codes.",
      "Security and service records needed to prevent fraud, protect the service, and investigate incidents."
    ]
  },
  {
    "title": "Why we use it",
    "body": "Personal information should be used only for the stated transaction or service purpose, legitimate security and fraud-prevention needs, legal obligations, customer support, and any separate marketing activity for which an appropriate lawful basis and notice exist.",
    "bullets": [
      "To create and protect accounts, confirm orders, and deliver products.",
      "To process, reconcile, refund, and evidence legitimate payments.",
      "To prevent abuse, verify webhook events, rate-limit sensitive requests, and investigate suspected fraud.",
      "To respond to customer questions, refunds, complaints, and data-subject requests."
    ]
  },
  {
    "title": "Sharing and international processing",
    "body": "Where service providers process information for hosting, authentication, payment, email, monitoring, or analytics, Loveli Luxury should document the provider, purpose, security obligations, retention, and any transfer safeguards before information is shared or processed outside Kenya.",
    "bullets": [
      "Do not sell personal information.",
      "Use processors only where a documented business purpose and appropriate safeguards exist.",
      "Publish and maintain a current processor and international-transfer record after counsel review."
    ]
  },
  {
    "title": "Retention, security, and your requests",
    "body": "Information should be retained only for as long as necessary for the stated purpose, legal obligations, fraud prevention, financial records, or dispute evidence. Customers should be able to request access, correction, deletion where applicable, or a review of how their information is handled through a published contact route.",
    "bullets": [
      "Use HTTPS, restricted access, role permissions, audit trails, and security monitoring.",
      "Maintain an approved retention schedule for account, order, payment, verification, support, and security records.",
      "Publish an approved privacy contact and complaint/escalation route before this page goes live."
    ]
  }
] as const

export default function PrivacydatausePage() {
  return (
    <article>
      <header className="border-b border-[hsl(var(--border))] pb-10 md:pb-12">
        <p className="text-eyebrow">Your information</p>
        <h1 className="mt-5 max-w-4xl font-serif text-4xl leading-tight tracking-[-0.02em] md:text-5xl">
          Privacy & data use
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
          How Loveli Luxury International intends to collect, use, protect, retain, and respond to requests about personal information.
        </p>
      </header>

      <section className="border-b border-[hsl(var(--border))] py-8">
        <p className="max-w-3xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          <strong className="font-medium text-[hsl(var(--foreground))]">Draft for legal review only.</strong>{' '}
          This policy has been prepared to establish a clear customer-facing standard. It must be reviewed and approved by Kenyan legal counsel before publication or contractual reliance.
        </p>
      </section>

      <div>
        {sections.map((section, index) => (
          <section
            key={section.title}
            className="grid gap-4 border-b border-[hsl(var(--border))] py-10 md:grid-cols-[3.75rem_minmax(0,1fr)] md:gap-7"
          >
            <p className="pt-1 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
              {String(index + 1).padStart(2, '0')}
            </p>
            <div>
              <h2 className="font-serif text-3xl tracking-[-0.02em]">{section.title}</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
                {section.body}
              </p>
              {section.bullets.length > 0 ? (
                <ul className="mt-5 space-y-3 border-l border-[hsl(var(--primary))]/35 pl-5 text-base leading-8 text-[hsl(var(--muted-foreground))]">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
