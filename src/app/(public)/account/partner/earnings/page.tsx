/**
 * /account/partner/earnings — PARTNER-ONLY compensation detail.
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

export const metadata = {
  title: 'Earnings & pricing',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

function kes(n: number): string {
  return `Kes ${n.toLocaleString('en-KE')}`
}

const PRICING = [
  { size: '30', purchase: 700, retail: 1500, margin: 800 },
  { size: '50', purchase: 1400, retail: 2800, margin: 1400 },
] as const

const MARGIN_30 = [
  { qty: 5, kes: 4_000 },
  { qty: 10, kes: 8_000 },
  { qty: 20, kes: 16_000 },
  { qty: 50, kes: 40_000 },
  { qty: 100, kes: 80_000 },
] as const

const MARGIN_50 = [
  { qty: 5, kes: 7_000 },
  { qty: 10, kes: 14_000 },
  { qty: 20, kes: 28_000 },
  { qty: 50, kes: 70_000 },
] as const

// Unilevel network commission, as a percentage of Point Value (PV). Your rank
// unlocks how many levels deep you earn (Ambassador = L1 ... Crown President = L1-5).
const LEVELS = [
  { level: 1, pct: '20%' },
  { level: 2, pct: '11%' },
  { level: 3, pct: '6%' },
  { level: 4, pct: '2%' },
  { level: 5, pct: '1%' },
] as const

export default function PartnerEarningsPage() {
  return (
    <div className="space-y-12">
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
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
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
                  <dd className="font-medium text-[hsl(var(--primary))]">
                    {kes(p.retail)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between rounded-md border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-4 py-3">
                <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  Your margin per bottle
                </span>
                <span className="font-serif text-2xl text-[hsl(var(--primary))]">
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
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <MarginTable title="30ml" rows={MARGIN_30} />
          <MarginTable title="50ml" rows={MARGIN_50} />
        </div>
      </section>

      {/* Network commission by level */}
      <section>
        <h2 className="font-serif text-2xl">Network commission by level</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Commissions are calculated on Point Value (PV). Your rank unlocks how
          many levels deep you earn. Ambassador earns Level 1; Crown President
          earns Levels 1–5.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
          <ul className="divide-y divide-[hsl(var(--border))]/60 text-sm">
            {LEVELS.map((l) => (
              <li key={l.level} className="flex items-center justify-between px-5 py-3">
                <span className="text-[hsl(var(--muted-foreground))]">Level {l.level}</span>
                <span className="font-medium text-[hsl(var(--primary))]">{l.pct} of PV</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rank earnings */}
      <section>
        <h2 className="font-serif text-2xl">Rank earnings</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Your rank sets how many network levels you earn on, plus your monthly
          lifestyle bonus. Advancement is on rolling-90-day verified retail
          performance.
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
                <li>◆ {tier.commissionLabel}</li>
                <li>◆ {tier.bonusLabel}</li>
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
            <span className="font-medium text-[hsl(var(--primary))]">
              {kes(r.kes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
