/**
 * /boss-scents — Partner Program explainer.
 *
 * Phase 1 rewrite (2026-05-18): refactored from the 8-rank Independent
 * Business Owner page into the 4-tier Loveli Luxury Partner Program
 * landing. Source of truth for the new tier names + earning structure
 * is `src/lib/partners/tiers.ts`. Phase 2 will collapse the underlying
 * schema (per MIGRATION_NOTES.md §1) and remove the rank→tier display
 * bridge.
 *
 * Recruitment language, "downline" framing, PV math tables, and any
 * "lifetime salary" claim have been stripped per the brand brief —
 * retention bonus is now described as quarterly, sales-tied, never
 * permanent. The URL slug stays `/boss-scents` for Phase 1; it can be
 * renamed to `/partner-program` in a follow-up if desired.
 */

import Link from 'next/link'
import { ALL_PARTNER_TIERS, type PartnerTier } from '@/lib/partners/tiers'

export const metadata = {
  title: 'Partner Program — Loveli Luxury',
  description:
    'A discreet partner program for creators, resellers, and regional curators of modern African luxury fragrance. Four tiers. Earnings tied to verified retail performance. Invite-only.',
}

function kes(n: number): string {
  return `Kes ${n.toLocaleString('en-KE')}`
}

export default function PartnerProgramPage() {
  return (
    <div className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-[hsl(var(--border))] bg-[#0D0D0D] py-28 text-center text-white md:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              'repeating-linear-gradient(45deg, transparent 0 40px, hsl(38 56% 60% / 0.08) 40px 41px)',
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-[hsl(38_56%_60%)]" />
            <div className="h-2 w-2 rotate-45 bg-[hsl(38_56%_60%)]" />
            <div className="h-px w-16 bg-[hsl(38_56%_60%)]" />
          </div>
          <p className="mb-5 inline-block border border-[hsl(38_56%_60%/0.5)] px-4 py-1 text-[10px] font-medium uppercase tracking-[0.4em] text-[hsl(38_56%_70%)]">
            Loveli Luxury · Partner Program
          </p>
          <h1 className="font-serif text-5xl font-bold leading-[1.05] md:text-7xl">
            Build a <em className="italic text-[hsl(38_56%_60%)]">luxury fragrance</em> business
          </h1>
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-[hsl(0_0%_55%)]">
            Four tiers · Verified retail performance · Editorial brand access
          </p>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[hsl(0_0%_75%)]">
            A discreet partner program for creators, resellers, and regional
            curators of modern African luxury fragrance. Earn alongside the
            house — retail margin on every bottle you place, tier commission
            on every fragrance you introduce, and access tied to verified
            retail performance, not recruitment scale.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 md:flex-row">
            <Link
              href="/partners/signup"
              className="rounded-md bg-[hsl(38_56%_60%)] px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#0D0D0D] transition hover:bg-[hsl(38_56%_70%)]"
            >
              Join via your sponsor
            </Link>
            <a
              href="#tiers"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(0_0%_70%)] underline-offset-8 hover:underline"
            >
              See the tier ladder ↓
            </a>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[hsl(0_0%_45%)]">
            Invite-only · Sponsor code required
          </p>
        </div>
      </section>

      {/* ── PHILOSOPHY ───────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <SectionTitle eyebrow="01" title="A partner program, not a payout pyramid" />
          <p className="mt-8 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            Loveli Luxury rewards verified retail performance. Every commission
            references a real, paid, non-refunded order. Tiers advance on
            rolling-90-day sales metrics — not on the size of the network you
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

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionTitle eyebrow="02" title="Product pricing & your retail margin" />
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            <PricingCard
              size="30"
              ibo={900}
              sell={1500}
              profit={600}
            />
            <PricingCard
              size="50"
              ibo={1400}
              sell={2200}
              profit={800}
            />
          </div>
          <p className="mt-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
            Mandatory retail prices are fixed across all partners to protect
            the brand's positioning. The retail margin shown is what you earn
            on every bottle you personally place, on top of tier commission.
          </p>
        </div>
      </section>

      {/* ── RETAIL EARNINGS ──────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionTitle eyebrow="03" title="Retail margin at a glance" />
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            <EarningsCard
              title="30ml — retail margin examples"
              rows={[
                { qty: 5, kes: 3_000 },
                { qty: 10, kes: 6_000 },
                { qty: 20, kes: 12_000 },
                { qty: 50, kes: 30_000 },
                { qty: 100, kes: 60_000 },
              ]}
            />
            <EarningsCard
              title="50ml — retail margin examples"
              rows={[
                { qty: 5, kes: 4_000 },
                { qty: 10, kes: 8_000 },
                { qty: 20, kes: 16_000 },
                { qty: 50, kes: 40_000, label: '50 bottles · monthly cap per partner' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── TIER LADDER ──────────────────────────────────────────────── */}
      <section id="tiers" className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="04"
            title="Four tiers, each a career step"
            subtitle="Earnings progress with verified retail performance. Recruitment alone does not advance a tier — every override requires the partner to be selling personally."
          />
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {ALL_PARTNER_TIERS.map((tier) => (
              <TierCard key={tier.code} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRITY ────────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionTitle
            eyebrow="05"
            title="The rules the program runs on"
            subtitle="Hard rules enforced at the system level — not just on paper."
          />
          <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <IntegrityRule
              title="No payout without verified sales"
              body="Every commission row references a real, paid, non-refunded order. No phantom volume, ever."
            />
            <IntegrityRule
              title="No tier retention without sales"
              body="If 90-day verified retail sales fall below a tier's minimum, the partner is downgraded after a 30-day grace period and warning."
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
      <section className="border-b border-[hsl(var(--border))] bg-[#0D0D0D] py-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(38_56%_60%)]">
            Begin your partnership
          </p>
          <h2 className="mt-3 text-center font-serif text-4xl font-bold md:text-5xl">
            Three steps to your first bottle placed
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              n="1"
              title="Receive an invite"
              body="The program is invite-only. Ask a current partner for their sponsor code — they become your sponsor and guide as you start."
            />
            <StepCard
              n="2"
              title="Activate"
              body="Pay your onboarding kit and the joining fee. Your partner account activates the moment payment confirms. You earn from your first bottle."
            />
            <StepCard
              n="3"
              title="Sell and progress"
              body="Place fragrances. Advance through Concierge Partner, Brand Associate, Regional Curator, and Prestige Partner as your verified retail performance grows."
            />
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row">
            <Link
              href="/partners/signup"
              className="rounded-md bg-[hsl(38_56%_60%)] px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#0D0D0D] transition hover:bg-[hsl(38_56%_70%)]"
            >
              Join via your sponsor
            </Link>
            <Link
              href="/shop"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(0_0%_70%)] underline-offset-8 hover:underline"
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[hsl(38_56%_40%)]">
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

function PricingCard({
  size,
  ibo,
  sell,
  profit,
}: {
  size: '30' | '50'
  ibo: number
  sell: number
  profit: number
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-7">
      <div
        className="absolute right-0 top-0 h-12 w-12 bg-[hsl(38_56%_60%)]"
        style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }}
        aria-hidden
      />
      <p className="font-serif text-5xl font-bold leading-none">
        {size}
        <span className="text-lg text-[hsl(var(--muted-foreground))]">ml</span>
      </p>
      <div className="mt-6 space-y-2 text-sm">
        <PriceRow label="Your purchase price (partner)" value={kes(ibo)} />
        <PriceRow label="Mandatory retail price" value={kes(sell)} accent />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-4">
        <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-800">
          Your retail margin per bottle
        </p>
        <p className="font-serif text-3xl font-bold text-emerald-700">
          {kes(profit)}
        </p>
      </div>
    </div>
  )
}

function PriceRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-[hsl(var(--border))]/60 pb-2 last:border-none">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span
        className={`font-semibold ${accent ? 'text-[hsl(38_56%_40%)]' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}

function EarningsCard({
  title,
  rows,
}: {
  title: string
  rows: ReadonlyArray<{ qty: number; kes: number; label?: string }>
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6">
      <h4 className="border-b border-[hsl(var(--border))] pb-3 font-serif text-lg font-semibold">
        {title}
      </h4>
      <ul className="mt-2 divide-y divide-[hsl(var(--border))]/60 text-sm">
        {rows.map((r) => (
          <li
            key={r.qty}
            className="flex items-center justify-between py-2"
          >
            <span className="text-[hsl(var(--muted-foreground))]">
              {r.label ?? `Sell ${r.qty} bottles`}
            </span>
            <span className="font-semibold text-emerald-700">{kes(r.kes)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TierCard({ tier }: { tier: PartnerTier }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3 bg-[#0D0D0D] p-5">
        <div className="font-serif text-4xl font-bold leading-none text-[hsl(38_56%_60%)]">
          {String(tier.position).padStart(2, '0')}
        </div>
        <div className="flex-1">
          <p className="font-serif text-xl font-semibold text-white">
            {tier.displayName}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-[hsl(0_0%_50%)]">
            Tier {tier.position} of 4
          </p>
        </div>
      </div>

      <div className="p-5">
        <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {tier.tagline}
        </p>

        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed">
          <li className="flex gap-2 border-b border-[hsl(var(--border))]/60 py-1.5">
            <span className="mt-1 text-[6px] text-[hsl(38_56%_60%)]">◆</span>
            <span className="text-[hsl(var(--foreground))]/90">{tier.directRateLabel}</span>
          </li>
          <li className="flex gap-2 border-b border-[hsl(var(--border))]/60 py-1.5">
            <span className="mt-1 text-[6px] text-[hsl(38_56%_60%)]">◆</span>
            <span className="text-[hsl(var(--foreground))]/90">{tier.overrideLabel}</span>
          </li>
          <li className="flex gap-2 py-1.5">
            <span className="mt-1 text-[6px] text-[hsl(38_56%_60%)]">◆</span>
            <span className="text-[hsl(var(--foreground))]/90">
              Advancement based on rolling 90-day verified retail performance
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function IntegrityRule({
  title,
  body,
}: {
  title: string
  body: string
}) {
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
    <div className="rounded-lg border border-[hsl(38_56%_60%/0.3)] bg-[#0D0D0D] p-6">
      <p className="font-serif text-5xl font-bold leading-none text-[hsl(38_56%_60%)]">
        {n}
      </p>
      <h3 className="mt-4 font-serif text-xl font-semibold text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[hsl(0_0%_70%)]">{body}</p>
    </div>
  )
}
