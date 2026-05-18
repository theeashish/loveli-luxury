import Link from 'next/link'

export const metadata = {
  title: 'Authenticity — Loveli Luxury',
  description:
    'Every fragrance is authenticity verified before dispatch. How we source, store, and seal each bottle.',
}

/**
 * Editorial, restrained. Single column. Two short paragraphs per
 * section, no bullet noise unless the substance demands it. The brand
 * brief copy seed lives at the top so it carries the page.
 */
export default function AuthenticityPolicy() {
  return (
    <>
      <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
        Every fragrance is authenticity verified before dispatch.
      </h2>

      <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Counterfeit perfume is a real problem in our region. We built Loveli
        Luxury knowing that a customer's first concern isn't going to be the
        scent — it's whether the bottle in their hand is the real one. So our
        process starts well before the prompt to pay.
      </p>

      <h3 className="mt-12 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        How we source
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Our inventory comes from a small set of authorised distributors — the
        same channels that supply premium retail across East Africa. Every
        consignment arrives with its house documentation. Anything that doesn't
        match the paperwork is returned at our expense, not yours.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        How we store
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Temperature-stable, low-light storage in our Nairobi facility.
        Fragrance is fragile chemistry — heat, light, and rough handling change
        how a scent behaves on skin. Our handling protocol exists so the bottle
        on your dresser smells exactly like the one the house signed off.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        How we seal
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Every order is hand-inspected, sealed, and tamper-banded before the
        rider arrives. Open the box on camera if you want — we keep
        unboxing-friendly packaging precisely because we expect you to scrutinise
        it. If the seal is broken on arrival, do not accept the parcel; ping
        our Concierge and we send a replacement.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        If something is wrong
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        We refund or replace anything that fails authenticity inspection
        post-delivery. See the{' '}
        <Link
          href="/policies/refund"
          className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          refund policy
        </Link>{' '}
        for the mechanics. The fastest route is{' '}
        <span className="text-[hsl(var(--foreground))]">Concierge</span> on
        WhatsApp — we don't make you write an email and wait.
      </p>
    </>
  )
}
