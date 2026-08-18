import Link from 'next/link'
import { ALL_PARTNER_TIERS, type PartnerTier } from '@/lib/partners/tiers'
import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'
import { EditorialPhotoFrame } from '@/components/editorial/EditorialPhotoFrame'
import { CompensationPlanSection } from '@/components/partners/CompensationPlanSection'

export const metadata = {
  title: 'Partner Program | Loveli Luxury Scents',
  description:
    'An invite-only partner programme for creators, resellers, and regional curators of modern African luxury fragrance.',
  alternates: { canonical: '/partners' },
}

// Public tier language remains rate-free. Exact commission rates, earnings
// tables, margins, and pricing remain partner-only inside the portal.
const TIER_PITCH: Record<PartnerTier['code'], string> = {
  ambassador: 'Where every partnership begins. Build with the fragrances you personally place.',
  executive: 'Develop your own clientele while taking a more active role in your growing business.',
  gold_director: 'Lead a growing organisation with a deeper relationship to the house and its launches.',
  platinum_director: 'A senior leader with broader responsibilities, brand access, and a voice in the house.',
  crown_president: "The house's inner circle: long-term leadership, recognition, and limited-edition allocation.",
}

const INTEGRITY_RULES = [
  ['Verified retail only', 'Every commission references a real, paid, non-refunded order.'],
  ['Progress needs sales', 'Rank progression and retention depend on verified retail performance, not network size alone.'],
  ['No recruitment-only rewards', 'A partner without personal retail activity cannot earn from a network.'],
  ['Refunds are handled', 'If an order is refunded, we may adjust the related commission.'],
  ['Checks protect payments', 'We check details when needed to keep partner payments safe.'],
  ['No income guarantees', 'The programme does not promise an income. Outcomes depend on verified retail performance.'],
] as const

export default async function PartnerProgramPage() {
  const [hero, program] = await Promise.all([
    getSection('partner_landing'),
    getSection('partner_program'),
  ])

  return (
    <div>
      <section className="relative overflow-hidden border-b border-[hsl(var(--border))]/70">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-28 top-4 h-96 w-96 rounded-full bg-[hsl(var(--primary))]/[0.07] blur-3xl" />
          <div className="absolute right-[6%] top-[-10rem] h-[31rem] w-[31rem] rounded-full border border-[hsl(var(--primary))]/15" />
          <div className="absolute right-[32%] top-[20%] h-20 w-20 rounded-full border border-[hsl(var(--primary))]/15" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-16 md:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.64fr)] md:items-end md:py-24">
          <div className="max-w-3xl">
            <p className="text-eyebrow">{hero.eyebrow}</p>
            <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-tight text-[hsl(var(--foreground))] md:text-6xl lg:text-7xl">
              <HighlightText text={hero.headline} />
            </h1>
            <p className="mt-7 text-[10px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--primary))]">
              {hero.microtag}
            </p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              {hero.subhead}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/partners/signup"
                className="rounded-sm bg-[hsl(var(--foreground))] px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
              >
                {hero.ctaLabel}
              </Link>
              <a
                href={hero.secondaryHref}
                className="px-2 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--primary))] underline-offset-8 transition hover:underline"
              >
                {hero.secondaryLabel}
              </a>
            </div>
            <p className="mt-6 text-[9px] uppercase tracking-[0.26em] text-[hsl(var(--muted-foreground))]">
              {hero.inviteNote}
            </p>
          </div>

          <EditorialPhotoFrame
            src={program.photo.heroUrl}
            alt={program.photo.heroAlt}
            label="The partner programme"
            caption={program.photo.heroCaption}
            monogram="LP"
            className="mx-auto w-full max-w-sm"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:py-18">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-eyebrow">{program.philosophyEyebrow}</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              {program.philosophyHeadline}
            </h2>
          </div>
          <div className="border-y border-[hsl(var(--border))] py-8 md:py-10">
            <p className="max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              {program.philosophyBody}
            </p>
            <p className="mt-8 border-l border-[hsl(var(--primary))]/50 pl-5 font-serif text-2xl italic leading-tight text-[hsl(var(--foreground))] md:text-3xl">
              {program.philosophyNote}
            </p>
          </div>
        </div>
      </section>

      <section id="tiers" className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/35">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-18">
          <div className="max-w-3xl">
            <p className="text-eyebrow">{program.tiersEyebrow}</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              {program.tiersHeadline}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
              {program.tiersLead}
            </p>
          </div>

          <ol className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            {ALL_PARTNER_TIERS.map((tier, index) => (
              <TierCard key={tier.code} tier={tier} index={index} />
            ))}
          </ol>
          <p className="mt-10 border-t border-[hsl(var(--border))] pt-6 text-[10px] font-medium uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
            {program.tiersFootnote}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:py-18">
        <div className="grid gap-12 md:grid-cols-[minmax(17rem,0.74fr)_minmax(0,1.26fr)] md:items-center lg:gap-24">
          <EditorialPhotoFrame
            src={program.photo.storiesUrl}
            alt={program.photo.storiesAlt}
            label="Life around the programme"
            caption={program.photo.storiesCaption}
            monogram="ST"
            className="mx-auto w-full max-w-sm md:mx-0"
          />
          <div>
            <p className="text-eyebrow">{program.storiesEyebrow}</p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              {program.storiesHeadline}
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              {program.storiesBody}
            </p>
            <Link
              href="/partners/agreement"
              className="mt-8 inline-flex text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--primary))] underline-offset-8 transition hover:underline"
            >
              Read the partner agreement
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-18">
          <div className="max-w-3xl">
            <p className="text-eyebrow">Programme integrity</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              Trust is part of the work.
            </h2>
            <p className="mt-6 text-base leading-8 text-[hsl(var(--muted-foreground))]">
              These safeguards keep the programme centred on the product, verified retail activity, and fair treatment of every partner.
            </p>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {INTEGRITY_RULES.map(([title, body], index) => (
              <li key={title} className="border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
                <p className="text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-4 font-serif text-2xl tracking-tight text-[hsl(var(--foreground))]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:py-18">
        <div className="grid gap-10 border border-[hsl(var(--primary))]/25 bg-[hsl(var(--background))]/80 p-8 shadow-[0_20px_48px_-38px_hsl(var(--foreground)/0.6)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-12">
          <div className="max-w-2xl">
            <p className="text-eyebrow">{program.startEyebrow}</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              {program.startHeadline}
            </h2>
            <ol className="mt-7 grid gap-3 text-sm leading-7 text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
              <li><span className="mr-2 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">01</span>Receive a sponsor invitation.</li>
              <li><span className="mr-2 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">02</span>Review the terms and activate.</li>
              <li><span className="mr-2 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">03</span>Place fragrance with care.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link
              href="/partners/signup"
              className="rounded-sm bg-[hsl(var(--foreground))] px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            >
              Join via your sponsor
            </Link>
            <Link
              href="/ids"
              className="rounded-sm border border-[hsl(var(--primary))]/45 px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--primary))]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            >
              Read income disclosure
            </Link>
          </div>
        </div>
      </section>
      <CompensationPlanSection />
    </div>
  )
}

function TierCard({ tier, index }: { tier: PartnerTier; index: number }) {
  return (
    <li className={`border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 transition duration-200 hover:-translate-y-1 hover:border-[hsl(var(--primary))]/55 hover:shadow-[0_18px_36px_-30px_hsl(var(--foreground)/0.6)] ${index === 4 ? 'md:col-span-2 md:max-w-[calc(50%-0.625rem)]' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
          {String(tier.position).padStart(2, '0')}
        </p>
        <p className="text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">Rank {tier.position} of 5</p>
      </div>
      <h3 className="mt-5 font-serif text-3xl tracking-tight text-[hsl(var(--foreground))]">{tier.displayName}</h3>
      <p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">{TIER_PITCH[tier.code]}</p>
      <p className="mt-5 border-t border-[hsl(var(--border))] pt-4 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
        Verified retail progression
      </p>
    </li>
  )
}
