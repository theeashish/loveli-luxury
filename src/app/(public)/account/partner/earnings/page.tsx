import Image from 'next/image'
/**
 * /account/partner/earnings Ã¢â‚¬â€ PARTNER-ONLY compensation detail.
 *
 * The pricing, retail margins, earnings examples, and exact commission rates
 * that used to sit on the PUBLIC /partners page live here, behind the partner
 * login (the /account/partner layout gates access). Per the owner's privacy
 * rule (2026-05-21): the numbers are for partners only.
 *
 * Reflects the client comp plan applied 2026-05-22 (masterplan Appendix C):
 * unilevel L1-L5 at 20/11/6/2/1, PV-based, rank unlocks the number of levels.
 */

import { ALL_PARTNER_TIERS } from '@/lib/partners/tiers'
import { LOVELI_COMPENSATION } from '@/lib/partners/compensation-plan'

export const metadata = {
  title: 'Earnings & pricing',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

function kes(n: number): string {
  return `Kes ${n.toLocaleString('en-KE')}`
}

const plan = LOVELI_COMPENSATION
const PRICING = [
  {
    size: '50',
    purchase: plan.activation.iboPriceKes,
    retail: plan.activation.suggestedRetailKes,
    margin: plan.activation.retailProfitKes,
  },
] as const
const MARGIN_50 = [5, 10, 20, 50, 100].map((qty) => ({
  qty,
  kes: qty * plan.activation.retailProfitKes,
}))

// Unilevel network commission, as a percentage of Point Value (PV). Your rank
// unlocks how many levels deep you earn (Ambassador = L1 ... Crown President = L1-5).
const LEVELS = LOVELI_COMPENSATION.commissionLevels.map((level) => ({
  level: level.level,
  pct: `${level.percentage}%`,
}))

export default function PartnerEarningsPage() {
  return (
    <div className="space-y-12">
      <div className="flex items-center"><Image src="/loveli-luxury-logo.png" alt="Loveli Luxury Scents" width={112} height={120} className="h-20 w-auto object-contain object-left" priority /></div>
      <div className="rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        These figures are confidential to Loveli Luxury partners. Please keep
        them within the partner community.
      </div>

      {/* Pricing & margin */}
      <section>
        <h2 className="font-serif text-2xl">Product pricing &amp; your retail margin</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Retail prices are fixed across all partners to protect the brand. The
          margin shown is what you earn on every bottle you personally place, on
          top of network commission.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-1 max-w-xl">
          {PRICING.map((p) => (
            <div
              key={p.size}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6"
            >
              <p className="font-serif text-4xl">
                {p.size}
                <span className="text-lg text-[hsl(var(--muted-foreground))]">ml</span>
              </p>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between border-b border-[hsl(var(--border))]/60 pb-2">
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    Your purchase price (partner)
                  </dt>
                  <dd className="font-medium">{kes(p.purchase)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[hsl(var(--muted-foreground))]">
                    Mandatory retail price
                  </dt>
                  <dd className="font-medium text-[hsl(var(--brand-champagne-deep))]">
                    {kes(p.retail)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between rounded-md border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-4 py-3">
                <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  Your margin per bottle
                </span>
                <span className="font-serif text-2xl text-[hsl(var(--brand-champagne-deep))]">
                  {kes(p.margin)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Retail margin at a glance */}
      <section>
        <h2 className="font-serif text-2xl">Retail margin at a glance</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-1 max-w-xl">
          <MarginTable title="50ml" rows={MARGIN_50} />
        </div>
      </section>

      {/* Commission by level */}
      <section>
        <h2 className="font-serif text-2xl">Commission by level</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Your commission is based on Point Value (PV). The number of levels you can earn from depends on your rank. Ambassador earns Level 1; Crown President earns Levels 1-5.</p>
        <div className="mt-6 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
          <ul className="divide-y divide-[hsl(var(--border))]/60 text-sm">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-center justify-between px-5 py-3">
                <span className="text-[hsl(var(--muted-foreground))]">Level {l.level}</span>
                <span className="font-medium text-[hsl(var(--brand-champagne-deep))]">{l.pct} of PV</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What each rank means */}
      <section>
        <h2 className="font-serif text-2xl">What each rank means</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Your rank determines how many commission levels you can earn from. You move up based on verified retail sales over the last 90 days.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ALL_PARTNER_TIERS.map((tier) => (
            <div
              key={tier.code}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-5"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-serif text-lg">{tier.displayName}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                  Rank {tier.position} of 5
                </p>
              </div>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                {tier.tagline}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-[hsl(var(--foreground))]/90">
                <li>Commission: {tier.commissionLabel}</li>
                <li>Bonus: {tier.bonusLabel}</li>
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function MarginTable({
  title,
  rows,
}: {
  title: string
  rows: ReadonlyArray<{ qty: number; kes: number }>
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6">
      <h3 className="border-b border-[hsl(var(--border))] pb-3 font-serif text-lg">
        {title}: retail margin examples
      </h3>
      <ul className="mt-2 divide-y divide-[hsl(var(--border))]/60 text-sm">
        {rows.map((r) => (
          <li key={r.qty} className="flex items-center justify-between py-2">
            <span className="text-[hsl(var(--muted-foreground))]">
              Sell {r.qty} bottles
            </span>
            <span className="font-medium text-[hsl(var(--brand-champagne-deep))]">
              {kes(r.kes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
