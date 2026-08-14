import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Loveli Luxury Partner Agreement',
  description: 'Terms governing participation in the Loveli Luxury Partner Programme.',
  robots: { index: false, follow: false },
}

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  const sectionId = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return (
    <section id={sectionId} className="border-t border-[hsl(var(--border))] py-8 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-2xl tracking-tight text-[hsl(var(--foreground))]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{children}</div>
    </section>
  )
}

export default function PartnerAgreementPage() {
  return (
    <div className="bg-[hsl(var(--background))]">
      <article className="mx-auto max-w-4xl px-6 py-16 md:px-10 md:py-24">
        <header className="border-b border-[hsl(var(--border))] pb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--primary))]">
            Loveli Luxury International
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[0.95] tracking-tight text-[hsl(var(--foreground))] md:text-7xl">
            Partner Agreement
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
            The terms governing participation in the Loveli Luxury Partner Programme.
          </p>
          <dl className="mt-8 grid max-w-2xl gap-5 border-t border-[hsl(var(--border))] pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Programme</dt>
              <dd className="mt-1 text-sm font-medium">Partner Programme</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Access</dt>
              <dd className="mt-1 text-sm font-medium">Invitation-only</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">Model</dt>
              <dd className="mt-1 text-sm font-medium">Retail-first</dd>
            </div>
          </dl>
        </header>

        <nav aria-label="Agreement contents" className="mt-8 border-y border-[hsl(var(--border))] py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">Agreement contents</p>
          <div className="mt-4 grid gap-x-5 gap-y-2 text-sm text-[hsl(var(--muted-foreground))] sm:grid-cols-2">
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#1-purpose-and-acceptance">1. Purpose and acceptance</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#2-invitation-eligibility-and-partner-status">2. Eligibility and partner status</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#3-activation-and-the-starter-package">3. Starter package</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#4-retail-first-business-model-and-compensation">4. Compensation</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#5-prices-wholesale-access-and-customer-treatment">5. Products and customers</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#6-brand-marketing-and-conduct">6. Brand and conduct</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#7-kyc-payout-details-and-taxes">7. Verification and payouts</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#8-data-protection-and-confidentiality">8. Data and confidentiality</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#9-payouts-adjustments-and-records">9. Adjustments and records</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#10-suspension-termination-and-consequences">10. Suspension and termination</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#11-changes-to-the-programme-or-agreement">11. Changes to the programme</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#12-notices-complaints-governing-law-and-disputes">12. Notices and disputes</a>
            <a className="transition hover:text-[hsl(var(--foreground))]" href="#13-entire-agreement-and-severability">13. Entire agreement</a>
          </div>
        </nav>

        <div className="mt-14">
          <Clause title="1. Purpose and acceptance">
            <p>
              This Partner Agreement governs participation in the Loveli Luxury partner programme. The programme allows approved partners to promote and sell genuine Loveli Luxury products to retail customers in accordance with this Agreement, the approved compensation plan, the Income Disclosure Statement, and the published customer policies.
            </p>
            <p>
              A final version of this Agreement will be accepted electronically. The Company must retain the partner identity, agreement version, acceptance time, acceptance method, and the complete accepted text. A partner must not participate unless the final version has been accepted and all required onboarding checks are complete.
            </p>
          </Clause>

          <Clause title="2. Invitation, eligibility, and partner status">
            <p>
              Participation is invitation-only. A prospective partner requires a valid sponsor invitation and must provide accurate, complete, and current onboarding information. The Company may accept, defer, decline, suspend, or terminate participation where lawful and reasonable, including where information is inaccurate, identity or phone verification is incomplete, fraud or misuse is suspected, or the programme rules are not followed.
            </p>
            <p>
              A partner is an independent business participant and is not an employee, worker, agent, franchisee, joint venturer, or legal representative of the Company. A partner has no authority to bind the Company, create obligations for it, alter product terms, receive money on its behalf, or make commitments in its name unless the Company gives prior written authority.
            </p>
          </Clause>

          <Clause title="3. Activation and the Starter package">
            <p>
              A prospective partner may be asked to select and pay for a Starter package. The product, any joining fee, delivery charge, and any permitted processing charge must be shown clearly before payment. Prices, stock availability, and the contents of the Starter package are those displayed at the time of the order and may change prospectively.
            </p>
            <p>
              Payment for a Starter package is a product purchase and does not itself create commission entitlement. Partner activation occurs only after the Company confirms the required payment and completes any required verification or approval steps. Until activation, the partner portal may be limited to verification status, Starter package purchase, and support.
            </p>
            <p>
              Returns, cancellations, exchanges, and refunds for products are governed by the published <Link href="/policies/refund" className="font-medium text-[hsl(var(--foreground))] underline underline-offset-4">Refund Policy</Link> and applicable law. Any refund or charge reversal may affect eligibility, partner status, commissions, or payouts associated with the affected sale.
            </p>
          </Clause>

          <Clause title="4. Retail-first business model and compensation">
            <p>
              The programme is retail-first. Commissions are payable only on confirmed, paid, non-refunded qualifying retail product sales under the approved compensation plan. Recruiting, enrolling, sponsoring, or activating a partner does not by itself generate commission. A partner’s own Starter package purchase is not commissionable.
            </p>
            <p>
              Any residual commission is determined by the approved compensation plan, including its rank, qualification, point-value, and verification rules. The Company may correct calculation errors, withhold or reverse amounts where a payment is reversed, refunded, fraudulent, duplicated, incorrectly credited, or otherwise not valid under the plan or applicable law.
            </p>
            <p>
              No income, sales volume, rank, reward, or lifestyle benefit is guaranteed. A partner must not state or imply that earnings are guaranteed, typical, effortless, recruitment-based, or available without genuine retail sales. The current <Link href="/ids" className="font-medium text-[hsl(var(--foreground))] underline underline-offset-4">Income Disclosure Statement</Link> forms part of the programme disclosures.
            </p>
          </Clause>

          <Clause title="5. Prices, wholesale access, and customer treatment">
            <p>
              Active partners may receive the partner price shown by the Company for eligible products. A separately approved wholesale participant may receive the wholesale price then shown by the Company, currently calculated as 25% below the retail price, subject to a minimum order of 12 bottles and any additional written conditions. Wholesale access is approval-controlled and may be suspended or withdrawn for misuse, non-payment, fraud, or material breach.
            </p>
            <p>
              Partners must present prices, product information, delivery estimates, refunds, warranties, and promotions accurately. They must not make medical, therapeutic, earnings, availability, delivery, authenticity, or discount claims that the Company has not approved in writing. Partners must treat customers fairly and promptly refer complaints, refund requests, safety concerns, and suspected counterfeit reports to the Company.
            </p>
          </Clause>

          <Clause title="6. Brand, marketing, and conduct">
            <p>
              The Company grants the partner a limited, revocable, non-transferable permission to use the Loveli Luxury name and approved marketing materials solely to promote genuine Loveli Luxury products in compliance with this Agreement. The partner must not register or use confusingly similar names, domains, social accounts, adverts, packaging, or documents; modify the Company’s trademarks; or represent an unofficial product or offer as authorised.
            </p>
            <p>
              Partners must act professionally, lawfully, and respectfully. Prohibited conduct includes deceptive marketing, spam, harassment, pressure selling, pyramid-scheme representations, false or unsubstantiated claims, selling counterfeit or unauthorised goods, manipulating referrals or orders, self-dealing to obtain rewards, interfering with another partner’s customer relationship, and publishing confidential Company or customer information without permission.
            </p>
          </Clause>

          <Clause title="7. KYC, payout details, and taxes">
            <p>
              The Company may require identity, age, contact, address, tax, payment-account, and other verification information before activation, payout, or where a risk, legal, fraud-prevention, or regulatory concern arises. A phone number used for M-Pesa payouts must be verified before a payout is made. The Company may delay or decline a payout where required verification is incomplete, inconsistent, or reasonably suspected to be inaccurate or fraudulent.
            </p>
            <p>
              Each partner is responsible for their own tax registration, reporting, and payment obligations unless applicable law requires the Company to make a deduction, withholding, report, or other action. The Company may request information or make deductions or disclosures where required by law or a lawful authority.
            </p>
          </Clause>

          <Clause title="8. Data protection and confidentiality">
            <p>
              The Company processes personal data for onboarding, identity and phone verification, order fulfilment, customer service, compensation administration, payout administration, fraud prevention, security, legal compliance, audit, and communication about the programme. The partner must read the Company’s Privacy Policy before accepting the final agreement. The final policy link, data-controller contact details, lawful bases, retention periods, international-transfer safeguards, and data-subject-rights process must be confirmed by counsel before publication.
            </p>
            <p>
              A partner must protect all non-public information received through the programme, including customer details, order information, payout information, programme reports, pricing not made public by the Company, and internal materials. Customer personal data may be used only for the authorised purpose and must not be sold, disclosed, copied, or used for unrelated marketing.
            </p>
          </Clause>

          <Clause title="9. Payouts, adjustments, and records">
            <p>
              Eligible commissions are subject to the Company’s payout timetable, thresholds, verification requirements, and reconciliation processes. The Company may hold, offset, reverse, or claw back a commission or payout where it reasonably identifies a refund, chargeback, duplicate payment, calculation error, breach, fraud, manipulation, or legal requirement. The Company will maintain reasonable records of such adjustments and provide an explanation on request, subject to confidentiality and legal limits.
            </p>
            <p>
              Partners must keep accurate records of their own business activities, customer communications, income, expenses, and tax obligations. A partner must promptly notify the Company of changes to contact, address, identity, payment, or tax information.
            </p>
          </Clause>

          <Clause title="10. Suspension, termination, and consequences">
            <p>
              The Company may suspend access or terminate this Agreement immediately where necessary to protect customers, the Company, the programme, or compliance obligations, including for fraud, unlawful conduct, material breach, unauthorised claims, non-payment, counterfeit activity, misuse of data or marks, or a material verification concern. Where practicable, the Company will give the partner notice and a reasonable opportunity to respond.
            </p>
            <p>
              On suspension or termination, the partner must stop representing themselves as a Loveli Luxury partner, stop using Company materials, stop accessing restricted systems, and return or securely delete confidential information where lawful. Termination does not remove accrued obligations, lawful recovery rights, confidentiality duties, audit obligations, or rights related to prior refunds, chargebacks, disputes, taxes, or data protection.
            </p>
          </Clause>

          <Clause title="11. Changes to the programme or agreement">
            <p>
              The Company may update products, prices, programme rules, compensation mechanics, policies, or this Agreement prospectively where reasonably necessary for operations, security, law, customer fairness, or programme integrity. Material changes to the final agreement must be communicated before taking effect, recorded with a new version number, and accepted where applicable law or the nature of the change requires renewed acceptance. Changes will not retrospectively take away rights already earned under valid prior terms except to correct error, fraud, refund, or legal non-compliance.
            </p>
          </Clause>

          <Clause title="12. Notices, complaints, governing law, and disputes">
            <p>
              Notices from the Company may be sent through the partner portal, the registered email address, SMS, or another recorded contact channel. Partners must keep their contact details current. Customer complaints and partner concerns should first be sent to the Company through the published support channel so the matter can be investigated promptly.
            </p>
            <p>
              The final approved agreement must specify the Company’s notices address, governing law, courts or alternative-dispute-resolution process, and any required consumer-rights carve-outs. Nothing in this Agreement is intended to exclude or limit a right that cannot lawfully be excluded or limited.
            </p>
          </Clause>

          <Clause title="13. Entire agreement and severability">
            <p>
              Once approved, this Agreement, the accepted compensation plan, the Income Disclosure Statement, the applicable product and customer policies, and any signed written addendum will form the entire agreement between the Company and the partner regarding programme participation. If a provision is unenforceable, it will be interpreted or replaced only to the extent necessary, and the remaining provisions will continue where lawful.
            </p>
          </Clause>
        </div>

        <p className="mt-12 text-xs leading-6 text-[hsl(var(--muted-foreground))]">
          <Link href="/partners" className="font-medium underline underline-offset-4">Return to partners</Link>
          {' · '}
          <Link href="/policies/refund" className="font-medium underline underline-offset-4">Refund Policy</Link>
          {' · '}
          <Link href="/ids" className="font-medium underline underline-offset-4">Income Disclosure Statement</Link>
        </p>
      </article>
    </div>
  )
}
