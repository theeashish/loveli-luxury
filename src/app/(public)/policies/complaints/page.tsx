import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Complaints & dispute resolution | Loveli Luxury Scents',
  description: 'The proposed route for reporting an order, payment, privacy, product, partner, or service concern and preserving a fair evidence trail.',
}

const sections = [
  {
    "title": "Start with a record",
    "body": "Customers should submit their order number, the contact number or email used for the order, a short description of the concern, and relevant evidence. Do not send passwords, one-time codes, full payment credentials, or unnecessary identity documents through public channels.",
    "bullets": [
      "For delivery, damage, wrong-item, or seal concerns, include clear photos or video where safe to do so.",
      "For payment concerns, include the approved provider reference and the date/time of the transaction.",
      "For privacy concerns, identify the account or contact detail involved without sending additional unnecessary personal data."
    ]
  },
  {
    "title": "Response and escalation",
    "body": "Loveli Luxury should acknowledge a complaint, assign an internal owner, preserve relevant order/payment/support evidence, and provide a written outcome or a reasoned update within an attorney-approved service standard.",
    "bullets": [
      "A proposed acknowledgement target is two business days.",
      "A proposed ordinary-resolution target is ten business days, with updates where investigation takes longer.",
      "Payment, fraud, safety, privacy, and legal matters should be escalated to designated management and advisers."
    ]
  },
  {
    "title": "Fair resolution",
    "body": "Resolution should follow the applicable policy, documented evidence, and the customer’s statutory rights. Possible outcomes may include clarification, delivery correction, replacement, refund, payment-provider investigation, account protection, or referral to an appropriate regulator or dispute mechanism.",
    "bullets": [
      "Do not suppress legitimate complaints or retaliate against a customer for raising one.",
      "Preserve a dated internal record of the complaint, evidence, decision-maker, outcome, and any refund or remediation.",
      "Attorney review must confirm the final escalation contacts and external-resolution wording."
    ]
  }
] as const

export default function ComplaintsdisputeresolutionPage() {
  return (
    <article>
      <header className="border-b border-[hsl(var(--border))] pb-10 md:pb-12">
        <p className="text-eyebrow">Making things right</p>
        <h1 className="mt-5 max-w-4xl font-serif text-4xl leading-tight tracking-[-0.02em] md:text-5xl">
          Complaints & dispute resolution
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
          The proposed route for reporting an order, payment, privacy, product, partner, or service concern and preserving a fair evidence trail.
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
