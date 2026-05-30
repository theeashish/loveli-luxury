/**
 * /partners — PUBLIC partner-program landing.
 *
 * Privacy rule (owner, 2026-05-21): this public page is for INVITATION and
 * ASPIRATION only. It must NOT expose pricing, retail margins, earnings
 * tables, or exact commission rates — that is partner-only information,
 * shown after joining at /account/partner/earnings. Anyone who wants the
 * numbers joins the program to see them.
 *
 * Tier names are shown as a career path (no rates). Source of truth for tier
 * identity is src/lib/partners/tiers.ts.
 */

import Link from 'next/link'
import { ALL_PARTNER_TIERS, type PartnerTier } from '@/lib/partners/tiers'
import { getSection } from '@/lib/content/site'
import { HighlightText } from '@/components/content/HighlightText'

export const metadata = {
  title: 'Partner Program — Loveli Luxury',
  description:
    'An invite-only partner program for creators, resellers, and regional curators of modern African luxury fragrance. Five ranks. Earnings tied to verified retail performance.',
}

// Rate-free, aspirational descriptions for the public tier ladder. The actual
// commission rates live behind the login on /account/partner/earnings.
const TIER_PITCH: Record<PartnerTier['code'], string> = {
  ambassador:
    'Where every partnership begins. Earn on the fragrances you personally place.',
  executive:
    'Build your own clientele and start earning two levels into your network.',
  gold_director:
    'Lead a growing organisation, with deeper team earnings and early access to launches.',
  platinum_director:
    'A senior leader with deep network earnings, brand access, and a voice in the house.',
  crown_president:
    'The house’s inner circle: the full earning ladder, top recognition, and limited-edition allocation.',
}

export default async function PartnerProgramPage() {
  const hero = await getSection('partner_landing')
  return (
    <div className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-28 text-center text-[hsl(var(--foreground))] md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              'repeating-linear-gradient(45deg, transparent 0 40px, hsl(38 40% 60% / 0.08) 40px 41px)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-[hsl(34_45%_42%)]" />
            <div className="h-2 w-2 rotate-45 bg-[hsl(34_45%_42%)]" />
            <div className="h-px w-16 bg-[hsl(34_45%_42%)]" />
          </div>
          <p className="mb-5 inline-block border border-[hsl(34_45%_42%/0.5)] px-4 py-1 text-[10px] font-medium uppercase tracking-[0.4em] text-[hsl(34_45%_36%)]">
            {hero.eyebrow}
          </p>
          <h1 className="font-serif text-5xl font-bold leading-[1.05] md:text-7xl">
            <HighlightText text={hero.headline} />
          </h1>
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            {hero.microtag}
          </p>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            {hero.subhead}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 md:flex-row">
            <Link
              href="/partners/signup"
              className="rounded-md bg-[hsl(var(--foreground))] px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[hsl(var(--background))] transition hover:opacity-90"
            >
              {hero.ctaLabel}
            </Link>
            <a
              href={hero.secondaryHref}
              className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))] underline-offset-8 hover:underline"
            >
              {hero.secondaryLabel}
            </a>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            {hero.inviteNote}
          </p>
        </div>
      </section>

      {/* ── PHILOSOPHY ───────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionTitle eyebrow="01" title="A partner program, not a payout pyramid" />
          <p className="mt-8 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            Loveli Luxury rewards verified retail performance. Every commission
            references a real, paid, non-refunded order. Ranks advance on
            rolling-90-day sales metrics, not on the size of the network you
            invite. There is no lifetime payout, no infinite obligation, no
            phantom volume. Retention bonuses, where they apply, are reviewed
            quarterly and tied to current performance.
          </p>
          <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            Calm. Editorial. Sales-led. The program supports creators and
            resellers who want to build a real fragrance business with a brand
            that takes restraint seriously.
          </p>
        </div>
      </section>

      {/* ── TIER LADDER (rate-free) ──────────────────────────────────── */}
      <section id="tiers" className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="02"
            title="Five ranks, each a career step"
            subtitle="Advancement is earned through verified retail performance. Recruitment alone never advances a rank. Full earning details are shared with partners after you join."
          />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {ALL_PARTNER_TIERS.map((tier) => (
              <TierCard key={tier.code} tier={tier} />
            ))}
          </div>
          <p className="mt-10 text-center text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))]">
            Pricing, retail margins, and exact earnings are shared with partners
            inside the portal.
          </p>
        </div>
      </section>

      {/* ── PARTNER STORIES ──────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionTitle
            eyebrow="03"
            title="Built by partners"
            subtitle="Real stories from the people building Loveli Luxury in their cities."
          />
          <p className="mt-8 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            From a single shelf to a regional following, our partners turn a
            love of fragrance into a business on their own terms. Verified
            partner stories are published here as the program grows.
          </p>
          <div className="mt-10">
            <Link
              href="/partners/signup"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))] underline-offset-8 hover:underline"
            >
              Add your story: join via your sponsor →
            </Link>
          </div>
        </div>
      </section>

      {/* ── INTEGRITY ────────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionTitle
            eyebrow="04"
            title="The rules the program runs on"
            subtitle="Hard rules enforced at the system level, not just on paper."
          />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <IntegrityRule
              title="No payout without verified sales"
              body="Every commission references a real, paid, non-refunded order. No phantom volume, ever."
            />
            <IntegrityRule
              title="No rank retention without sales"
              body="If 90-day verified retail sales fall below a rank's minimum, the partner is downgraded after a 30-day grace period and warning."
            />
            <IntegrityRule
              title="No recruitment-only qualification"
              body="A partner with zero personal sales in a 90-day window cannot earn overrides, regardless of network size."
            />
            <IntegrityRule
              title="Retention bonus, not lifetime salary"
              body="Where retention bonuses apply, they are reviewed quarterly by an admin batch, tied to verified target metrics, and never a default."
            />
            <IntegrityRule
              title="Refund propagation"
              body="If an order is refunded, the related commission flips to clawback and is netted against the next payout."
            />
            <IntegrityRule
              title="KYC gating"
              body="Payouts above a configurable threshold require completed KYC. Self-referral and velocity checks run on every signup."
            />
          </ul>
        </div>
      </section>

      {/* ── HOW TO START ─────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-20 text-[hsl(var(--foreground))]">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(34_45%_42%)]">
            Begin your partnership
          </p>
          <h2 className="mt-3 text-center font-serif text-4xl font-bold md:text-5xl">
            Three steps to your first bottle placed
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              n="1"
              title="Receive an invite"
              body="The program is invite-only. Ask a current partner for their sponsor code. They become your sponsor and guide as you start."
            />
            <StepCard
              n="2"
              title="Activate"
              body="Pay your onboarding kit and the joining fee. Your partner account activates the moment payment confirms, and your full earning details open in the portal."
            />
            <StepCard
              n="3"
              title="Sell and progress"
              body="Place fragrances. Advance through Ambassador, Executive, Gold Director, Platinum Director, and Crown President as your verified retail performance grows."
            />
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row">
            <Link
              href="/partners/signup"
              className="rounded-md bg-[hsl(var(--foreground))] px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[hsl(var(--background))] transition hover:opacity-90"
            >
              Join via your sponsor
            </Link>
            <Link
              href="/shop"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))] underline-offset-8 hover:underline"
            >
              Or shop as a customer →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── COMPONENTS ──────────────────────────────────────────────────────────

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[hsl(38_40%_40%)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

/** Public tier card — name + aspirational pitch ONLY. No rates (those are
 *  partner-only, on /account/partner/earnings). */
function TierCard({ tier }: { tier: PartnerTier }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3 bg-[hsl(var(--muted))] p-5">
        <div className="font-serif text-4xl font-bold leading-none text-[hsl(34_45%_42%)]">
          {String(tier.position).padStart(2, '0')}
        </div>
        <div className="flex-1">
          <p className="font-serif text-xl font-semibold text-[hsl(var(--foreground))]">
            {tier.displayName}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            Rank {tier.position} of 5
          </p>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {TIER_PITCH[tier.code]}
        </p>
        <p className="mt-4 border-t border-[hsl(var(--border))]/60 pt-3 text-xs leading-relaxed text-[hsl(var(--foreground))]/80">
          Advancement based on rolling 90-day verified retail performance.
        </p>
      </div>
    </div>
  )
}

function IntegrityRule({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5">
      <p className="font-serif text-base font-semibold">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
        {body}
      </p>
    </li>
  )
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[hsl(34_45%_42%/0.3)] bg-[hsl(var(--background))] p-6">
      <p className="font-serif text-5xl font-bold leading-none text-[hsl(34_45%_42%)]">
        {n}
      </p>
      <h3 className="mt-4 font-serif text-xl font-semibold text-[hsl(var(--foreground))]">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p>
    </div>
  )
}
