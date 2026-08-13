import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of sale & service | Loveli Luxury Scents',
  description: 'The proposed customer rules for purchasing fragrances, using accounts, and participating in Loveli Luxury services.',
}

const sections = [
  {
    "title": "Orders and availability",
    "body": "Product listings, pricing, availability, delivery coverage, and bundle contents should be presented clearly before checkout. An order is subject to payment confirmation, fraud screening, stock availability, and the approved delivery terms.",
    "bullets": [
      "Prices, promotional terms, and delivery charges must be visible before payment.",
      "Loveli Luxury may decline or cancel orders affected by pricing, stock, payment, fraud, or technical errors, with an appropriate refund where payment was taken.",
      "Customers must provide accurate account, contact, delivery, and payment information."
    ]
  },
  {
    "title": "Payments, refunds, and evidence",
    "body": "Payments should be processed through approved providers. The company must keep sufficient transaction, provider-reference, delivery, refund, and communication evidence to resolve legitimate payment questions and disputes.",
    "bullets": [
      "Payment completion is confirmed by the provider and the company payment record, not by a screenshot alone.",
      "Refund eligibility and timing are governed by the published returns and refunds policy.",
      "Refunded orders are not commissionable; partner clawbacks must follow the approved partner agreement and compensation plan."
    ]
  },
  {
    "title": "Accounts and acceptable use",
    "body": "Accounts are personal. Customers and partners must not impersonate others, bypass security, manipulate referrals or orders, interfere with other customers, make deceptive claims, or use the service unlawfully.",
    "bullets": [
      "Do not share passwords or access credentials.",
      "Do not use bots, scripts, or excessive requests to disrupt checkout, accounts, payment status, or partner processes.",
      "The company may suspend access where there is a credible security, fraud, legal, or policy concern, subject to a lawful and documented process."
    ]
  },
  {
    "title": "Governing terms",
    "body": "Counsel must complete the company’s legal name, registered address, governing law, jurisdiction, dispute-resolution process, notices, limitation language, and any country-specific terms before publication.",
    "bullets": [
      "This draft is not a substitute for attorney-approved terms.",
      "The company should publish a version date and preserve superseded versions after approval."
    ]
  }
] as const

export default function TermsofsaleservicePage() {
  return (
    <article>
      <header className="border-b border-[hsl(var(--border))] pb-10 md:pb-12">
        <p className="text-eyebrow">Clear commerce</p>
        <h1 className="mt-5 max-w-4xl font-serif text-4xl leading-tight tracking-[-0.02em] md:text-5xl">
          Terms of sale & service
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
          The proposed customer rules for purchasing fragrances, using accounts, and participating in Loveli Luxury services.
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
