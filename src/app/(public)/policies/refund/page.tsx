import Link from 'next/link'

export const metadata = {
  title: 'Refunds — Loveli Luxury',
  description:
    'How refunds work at Loveli Luxury. 7-day window from delivery. Sealed bottles only. M-Pesa reversal within 5 business days.',
}

/**
 * Refund policy. Conservative, industry-aligned for fragrance. Hard
 * limits: unopened/sealed only. Soft route: authenticity issues are
 * handled separately (replacement, not refund).
 */
export default function RefundPolicy() {
  return (
    <>
      <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
        Sealed and second-guessing? Send it back.
      </h2>

      <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Fragrance is a hygiene product. Once a bottle is opened, the next person
        in line can't safely receive it. That's why our refund policy looks the
        way it does — strict on the seal, generous on everything else.
      </p>

      <h3 className="mt-12 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        What qualifies
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        A standard refund applies when:
      </p>
      <ul className="mt-3 space-y-2 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        <li>The tamper seal is intact and the cellophane is unbroken.</li>
        <li>The bottle is unsprayed.</li>
        <li>You contact us within 7 days of delivery (we look at your tracking).</li>
        <li>The packaging is in the same condition we sent it in.</li>
      </ul>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        How to start one
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        WhatsApp our{' '}
        <span className="text-[hsl(var(--foreground))]">Concierge</span> with
        your order number. We arrange return collection at our cost — we don't
        ask you to find a courier. Once we receive the parcel and confirm the
        seal, we reverse the M-Pesa transaction within 5 business days. You'll
        see the reversal on the same number you paid from.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        If the bottle is wrong on arrival
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Damaged in transit, wrong fragrance picked, seal compromised, scent
        clearly off — that's not a refund situation, that's our error and we
        replace immediately. Open the box on camera if you can; it speeds the
        loop. See the{' '}
        <Link
          href="/policies/authenticity"
          className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          authenticity policy
        </Link>{' '}
        for what happens next.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        What doesn't qualify
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Sprayed bottles. Bottles outside the 7-day window. Discovery / sample
        kits (these are non-refundable by their nature). Custom or limited-edition
        orders where the bottle has been engraved or otherwise personalised.
        Anything where the seal or cellophane has been broken — even if the
        scent itself wasn't applied.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        Distributor / partner returns
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Onboarding kit purchases are covered by the same 7-day, sealed-only rule.
        Commission and tier consequences of a refund are documented in the{' '}
        partner agreement; the short version is that refunded orders aren't
        commissionable, and any commission already paid on a refunded order is
        clawed back against the next payout.
      </p>
    </>
  )
}
