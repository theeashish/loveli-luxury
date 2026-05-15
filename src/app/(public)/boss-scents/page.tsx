/**
 * /boss-scents — Independent Business Owner (IBO) marketing landing.
 *
 * The distributor-facing equivalent of the storefront. Ports the
 * compensation-plan HTML the client signed off on into a Next.js
 * component using the existing design tokens (black ink, gold accents,
 * Cormorant Garamond for serif headings, DM Sans for body — already
 * loaded by the layout fonts).
 *
 * All numbers on this page come from the canonical comp plan and must
 * stay in sync with migration 014 (config_ranks, config_commission_rates,
 * product_variants.pv_per_bottle). If the comp plan changes in SQL,
 * update this page too — it's the prospect-facing rendering.
 */

import Link from 'next/link'

export const metadata = {
  title: 'Boss Scents — Independent Business Owner Program',
  description:
    'Build a luxury fragrance business with Loveli Luxury International. Earn retail profit on every bottle, plus 7-level network commissions on Point Value, plus a lifetime monthly salary from Manager rank up.',
}

const COMMISSION_LEVELS = [
  { level: 'L1', rate: '20%', pv50: 190, pv30: 110, who: 'Your direct recruits' },
  { level: 'L2', rate: '7%', pv50: 66.5, pv30: 38.5, who: '2nd generation downline' },
  { level: 'L3', rate: '5%', pv50: 47.5, pv30: 27.5, who: '3rd generation downline' },
  { level: 'L4', rate: '4%', pv50: 38, pv30: 22, who: '4th generation downline' },
  { level: 'L5', rate: '2%', pv50: 19, pv30: 11, who: '5th generation downline' },
  { level: 'L6', rate: '1.5%', pv50: 14.25, pv30: 8.25, who: '6th generation downline' },
  { level: 'L7', rate: '0.5%', pv50: 4.75, pv30: 2.75, who: '7th generation downline' },
] as const

const RANKS = [
  {
    n: '01',
    name: 'Starter',
    sub: 'Entry rank',
    personal: '5 × 50ml',
    members: 10,
    levels: 'L1 only',
    groupTarget: 70_000,
    bonus: 5_000,
    salary: null,
    bonusMonths: 'On target hit',
    perks: [
      'Retail profit of Kes 800 per 50ml · Kes 600 per 30ml',
      'Network commission on L1 (20%) — Kes 190 per 50ml sold in downline',
      'Rank-up bonus Kes 5,000 upon hitting target',
    ],
  },
  {
    n: '02',
    name: 'Team Builder',
    sub: 'Rank 2',
    personal: '10 × 50ml',
    members: 20,
    levels: 'L1 – L2',
    groupTarget: 200_000,
    bonus: 10_000,
    salary: null,
    bonusMonths: '2 months',
    perks: [
      'Commission on L1 (20%) + L2 (7%)',
      'Target from L1 + L2 combined',
      'Rank-up bonus Kes 10,000 after 2 months hitting target',
    ],
  },
  {
    n: '03',
    name: 'Builder',
    sub: 'Rank 3',
    personal: '15 × 50ml',
    members: 35,
    levels: 'L1 – L3',
    groupTarget: 500_000,
    bonus: 20_000,
    salary: null,
    bonusMonths: '2 months',
    perks: [
      'Commission on L1 (20%) + L2 (7%) + L3 (5%)',
      'Target from L1 + L2 + L3 combined',
      'Rank-up bonus Kes 20,000 after 2 months hitting target',
    ],
  },
  {
    n: '04',
    name: 'Manager',
    sub: 'Rank 4',
    personal: '20 × 50ml',
    members: 50,
    levels: 'L1 – L4',
    groupTarget: 1_000_000,
    bonus: 40_000,
    salary: 20_000,
    bonusMonths: '3 months',
    perks: [
      'Commission on L1 + L2 + L3 + L4',
      'Rank-up bonus Kes 40,000 after 3 months hitting target',
      'Monthly lifetime salary Kes 20,000 every month target is met',
    ],
  },
  {
    n: '05',
    name: 'Senior Manager',
    sub: 'Rank 5',
    personal: '25 × 50ml',
    members: 100,
    levels: 'L1 – L5',
    groupTarget: 2_500_000,
    bonus: 60_000,
    salary: 50_000,
    bonusMonths: '3 months',
    perks: [
      'Commission across all 5 unlocked levels',
      'Rank-up bonus Kes 60,000 after 3 months hitting target',
      'Monthly lifetime salary Kes 50,000',
    ],
  },
  {
    n: '06',
    name: 'Director',
    sub: 'Rank 6',
    personal: '35 × 50ml',
    members: 200,
    levels: 'L1 – L6',
    groupTarget: 4_500_000,
    bonus: 100_000,
    salary: 100_000,
    bonusMonths: '2 months',
    perks: [
      'Commission on L1–L6 (20%, 7%, 5%, 4%, 2%, 1.5%)',
      'Rank-up bonus Kes 100,000 after 2 months hitting target',
      'Monthly lifetime salary Kes 100,000',
    ],
  },
  {
    n: '07',
    name: 'Senior Director',
    sub: 'Rank 7',
    personal: '45 × 50ml',
    members: 400,
    levels: 'L1 – L7',
    groupTarget: 7_000_000,
    bonus: 150_000,
    salary: 150_000,
    bonusMonths: '2 months',
    perks: [
      'Full commission on all 7 levels (20%, 7%, 5%, 4%, 2%, 1.5%, 0.5%)',
      'Rank-up bonus Kes 150,000 after 2 months hitting target',
      'Monthly lifetime salary Kes 150,000',
    ],
  },
] as const

const PRESIDENT = {
  n: '08',
  name: 'President',
  sub: 'Elite top rank · Highest honours',
  personal: '50 × 50ml',
  members: 600,
  levels: 'All 7 levels',
  groupTarget: 10_000_000,
  bonus: 250_000,
  salary: 250_000,
  bonusMonths: '3 months',
  perks: [
    'Maximum retail profit — up to 50 personal bottles of 50ml = Kes 40,000 retail/month',
    'Full network commission on all 7 levels',
    'Rank-up bonus Kes 250,000 after 3 consecutive months hitting target',
    'Monthly lifetime performance salary Kes 250,000',
    'Recognised as a Loveli Luxury International Founding President',
  ],
} as const

function kes(n: number): string {
  return `Kes ${n.toLocaleString('en-KE')}`
}

export default function BossScentsPage() {
  return (
    <div className="bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-b border-[hsl(var(--border))] bg-[#0D0D0D] py-24 text-center text-white md:py-32">
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
            Independent Business Owner Program
          </p>
          <h1 className="font-serif text-5xl font-bold leading-[1.05] md:text-7xl">
            Boss <em className="italic text-[hsl(38_56%_60%)]">Scents</em>
          </h1>
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-[hsl(0_0%_55%)]">
            8 Ranks · 7 Commission Levels · Lifetime Salary
          </p>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[hsl(0_0%_75%)]">
            Build a luxury fragrance business with Loveli Luxury International.
            Earn <strong className="text-[hsl(38_56%_70%)]">retail profit</strong>{' '}
            on every bottle you personally sell, plus{' '}
            <strong className="text-[hsl(38_56%_70%)]">network commissions</strong>{' '}
            on the Point Value of every bottle sold by your downline — up to 7
            levels deep. Total network commission pool is{' '}
            <strong>40% of PV</strong>.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 md:flex-row">
            <Link
              href="/distributors/signup"
              className="rounded-md bg-[hsl(38_56%_60%)] px-8 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#0D0D0D] transition hover:bg-[hsl(38_56%_70%)]"
            >
              Join via your sponsor
            </Link>
            <a
              href="#ranks"
              className="text-xs uppercase tracking-[0.3em] text-[hsl(0_0%_70%)] underline-offset-8 hover:underline"
            >
              See the comp plan ↓
            </a>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[hsl(0_0%_45%)]">
            Invite-only · Sponsor code required
          </p>
        </div>
      </section>

      {/* ── PRICING + PV ─────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionTitle eyebrow="01" title="Product Pricing, PV & Retail Profit" />
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            <PricingCard
              size="30"
              ibo={900}
              sell={1500}
              pv={550}
              profit={600}
            />
            <PricingCard
              size="50"
              ibo={1400}
              sell={2200}
              pv={950}
              profit={800}
            />
          </div>
        </div>
      </section>

      {/* ── RETAIL EARNINGS ──────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionTitle eyebrow="02" title="Your Retail Earnings at a Glance" />
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            <EarningsCard
              title="30ml — Retail Profit Examples"
              rows={[
                { qty: 5, kes: 3_000 },
                { qty: 10, kes: 6_000 },
                { qty: 20, kes: 12_000 },
                { qty: 50, kes: 30_000 },
                { qty: 100, kes: 60_000 },
              ]}
            />
            <EarningsCard
              title="50ml — Retail Profit Examples"
              rows={[
                { qty: 5, kes: 4_000 },
                { qty: 10, kes: 8_000 },
                { qty: 20, kes: 16_000 },
                { qty: 50, kes: 40_000, label: '50 bottles (max personal)' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── COMMISSION TABLE ─────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <SectionTitle
            eyebrow="03"
            title="Network Commission Structure"
            subtitle="7 Levels · 40% of every bottle's Point Value paid out. 30ml = 550 PV. 50ml = 950 PV."
          />

          <div className="mt-10 overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="min-w-full bg-[hsl(var(--background))] text-sm">
              <thead className="bg-[#0D0D0D] text-[hsl(38_56%_60%)]">
                <tr className="text-left text-[10px] uppercase tracking-[0.2em]">
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Rate of PV</th>
                  <th className="px-4 py-3 text-right">Commission / 50ml (950 PV)</th>
                  <th className="px-4 py-3 text-right">Commission / 30ml (550 PV)</th>
                  <th className="px-4 py-3">Who this covers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {COMMISSION_LEVELS.map((row) => (
                  <tr key={row.level}>
                    <td className="px-4 py-3 font-mono font-bold">{row.level}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded bg-[hsl(38_56%_60%)] px-2 py-1 text-[11px] font-bold text-[#0D0D0D]">
                        {row.rate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      Kes {row.pv50.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      Kes {row.pv30.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {row.who}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[hsl(var(--muted))] font-bold text-[hsl(38_56%_40%)]">
                  <td className="px-4 py-3" colSpan={2}>
                    Total commission pool
                  </td>
                  <td className="px-4 py-3 text-right">Kes 380.00 / bottle</td>
                  <td className="px-4 py-3 text-right">Kes 220.00 / bottle</td>
                  <td className="px-4 py-3 text-[10px] uppercase tracking-[0.15em]">
                    40% of PV
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 8 RANKS ──────────────────────────────────────────────────── */}
      <section id="ranks" className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle
            eyebrow="04"
            title="8 Ranks — Requirements & Benefits"
            subtitle="Maximum personal sales: 50 bottles of 50ml per month. Active members must maintain personal sales each month. Targets are group sales volume (KES) from all active levels at each rank."
          />

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {RANKS.map((r) => (
              <RankCard key={r.n} rank={r} />
            ))}
          </div>

          {/* President — full width feature card */}
          <div className="mt-6 overflow-hidden rounded-lg border-2 border-[hsl(38_56%_60%)] bg-[hsl(var(--background))]">
            <div
              className="flex items-center gap-4 p-6"
              style={{
                background:
                  'linear-gradient(135deg, #130F00 0%, #2C2200 60%, #0D0D0D 100%)',
              }}
            >
              <div className="font-serif text-5xl font-bold leading-none text-[hsl(38_56%_60%)]">
                {PRESIDENT.n}
              </div>
              <div className="flex-1">
                <p className="font-serif text-3xl font-semibold text-white">
                  {PRESIDENT.name}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[hsl(38_56%_70%)]">
                  {PRESIDENT.sub}
                </p>
              </div>
              <div className="rounded-md border border-[hsl(38_56%_60%/0.6)] bg-[hsl(38_56%_60%/0.15)] px-4 py-3 text-right">
                <p className="text-[9px] uppercase tracking-[0.2em] text-[hsl(38_56%_70%)]">
                  Group target
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-[hsl(38_56%_80%)]">
                  {kes(PRESIDENT.groupTarget)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">
              <MetaBox label="Personal sales" value={PRESIDENT.personal} />
              <MetaBox label="Active members" value={String(PRESIDENT.members)} />
              <MetaBox label="Levels unlocked" value={PRESIDENT.levels} />
              <MetaBox
                label="Monthly salary"
                value={kes(PRESIDENT.salary)}
                tone="green"
              />
            </div>
            <ul className="space-y-2 px-6 pb-6 text-sm">
              {PRESIDENT.perks.map((perk) => (
                <li
                  key={perk}
                  className="flex gap-3 border-b border-[hsl(var(--border))] py-2 leading-relaxed last:border-none"
                >
                  <span className="mt-1 text-[8px] text-[hsl(38_56%_60%)]">◆</span>
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── SUMMARY TABLE ────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionTitle eyebrow="05" title="Rank Summary at a Glance" />

          <div className="mt-10 overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="min-w-full bg-[hsl(var(--background))] text-xs">
              <thead className="bg-[#1C1C1C] text-[hsl(38_56%_60%)]">
                <tr className="text-left uppercase tracking-[0.15em]">
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Rank</th>
                  <th className="px-3 py-3">Personal</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3">Levels</th>
                  <th className="px-3 py-3 text-right">Group target</th>
                  <th className="px-3 py-3 text-right">Rank-up bonus</th>
                  <th className="px-3 py-3">Qual months</th>
                  <th className="px-3 py-3 text-right">Monthly salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {[...RANKS, PRESIDENT].map((r) => (
                  <tr key={r.n} className="even:bg-[hsl(var(--muted))]/40">
                    <td className="px-3 py-3 font-mono">{r.n}</td>
                    <td
                      className={`px-3 py-3 font-semibold whitespace-nowrap ${
                        r.name === 'President' ? 'text-[hsl(38_56%_40%)]' : ''
                      }`}
                    >
                      {r.name}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{r.personal}</td>
                    <td className="px-3 py-3">{r.members}</td>
                    <td className="px-3 py-3">{r.levels}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {kes(r.groupTarget)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {kes(r.bonus)}
                    </td>
                    <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                      {r.bonusMonths}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.salary !== null ? kes(r.salary) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-[hsl(var(--muted-foreground))]">
            Mandatory selling prices are fixed and non-negotiable. Active member
            counts must be maintained every month to retain rank benefits.
            Monthly salaries are performance-based and paid only in months where
            group targets are achieved. Rank-up bonuses are one-time awards per
            rank.
          </p>
        </div>
      </section>

      {/* ── HOW TO START ─────────────────────────────────────────────── */}
      <section className="border-b border-[hsl(var(--border))] bg-[#0D0D0D] py-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-[hsl(38_56%_60%)]">
            Get started
          </p>
          <h2 className="mt-3 text-center font-serif text-4xl font-bold md:text-5xl">
            How to launch your business
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <StepCard
              n="1"
              title="Get an invite"
              body="Boss Scents is invite-only. Get a sponsor link from an existing distributor — they're your upline and your guide."
            />
            <StepCard
              n="2"
              title="Activate"
              body="Pay your registration fee + starter package. From this purchase you're an IBO, eligible to earn retail profit and L1 commission immediately."
            />
            <StepCard
              n="3"
              title="Maintain & climb"
              body="Hit your rank's monthly personal sales target to keep earning. Recruit two active partners, hit your team target, and you rank up — unlocking deeper levels and salary."
            />
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 md:flex-row">
            <Link
              href="/distributors/signup"
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
  pv,
  profit,
}: {
  size: '30' | '50'
  ibo: number
  sell: number
  pv: number
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
        <PriceRow label="Your purchase price (IBO)" value={kes(ibo)} />
        <PriceRow
          label="Mandatory selling price"
          value={kes(sell)}
          accent
        />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md border border-[hsl(38_56%_60%/0.4)] bg-[hsl(38_56%_60%/0.08)] p-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.15em] text-[hsl(38_56%_40%)]">
            Point Value (PV) per bottle
          </p>
        </div>
        <p className="font-serif text-3xl font-bold text-[hsl(38_56%_40%)]">
          {pv} PV
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-800">
            Your retail profit per bottle
          </p>
        </div>
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
        className={`font-semibold ${
          accent ? 'text-[hsl(38_56%_40%)]' : ''
        }`}
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

function RankCard({
  rank,
}: {
  rank: (typeof RANKS)[number]
}) {
  const filled = parseInt(rank.levels.match(/L1\s*–\s*L?(\d)/)?.[1] ?? '1', 10)
  return (
    <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3 bg-[#0D0D0D] p-5">
        <div className="font-serif text-4xl font-bold leading-none text-[hsl(38_56%_60%)]">
          {rank.n}
        </div>
        <div className="flex-1">
          <p className="font-serif text-xl font-semibold text-white">
            {rank.name}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-[hsl(0_0%_50%)]">
            {rank.sub}
          </p>
        </div>
        <div className="rounded-md border border-[hsl(38_56%_60%/0.4)] bg-[hsl(38_56%_60%/0.15)] px-2.5 py-1.5 text-right">
          <p className="text-[8px] uppercase tracking-[0.15em] text-[hsl(38_56%_60%)]">
            Group
          </p>
          <p className="font-serif text-sm font-bold text-[hsl(38_56%_70%)] whitespace-nowrap">
            {kes(rank.groupTarget)}
          </p>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3 flex gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded ${
                i < filled
                  ? 'bg-[hsl(38_56%_60%)]'
                  : 'bg-[hsl(var(--border))]'
              }`}
            />
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <MetaBox label="Personal" value={rank.personal} small />
          <MetaBox label="Active" value={`${rank.members}/mo`} small />
          <MetaBox label="Levels" value={rank.levels} small />
        </div>

        <ul className="space-y-1.5 text-xs leading-relaxed">
          {rank.perks.map((perk) => (
            <li
              key={perk}
              className="flex gap-2 border-b border-[hsl(var(--border))]/60 py-1.5 last:border-none"
            >
              <span className="mt-1 text-[6px] text-[hsl(38_56%_60%)]">◆</span>
              <span className="text-[hsl(var(--foreground))]/90">{perk}</span>
            </li>
          ))}
          {rank.salary ? (
            <li className="mt-2 inline-flex items-center gap-2 rounded bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700">
              Lifetime salary · {kes(rank.salary)}/mo
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function MetaBox({
  label,
  value,
  small,
  tone,
}: {
  label: string
  value: string
  small?: boolean
  tone?: 'green'
}) {
  return (
    <div
      className={`border-l-2 px-2.5 ${small ? 'py-2' : 'py-3'} ${
        tone === 'green'
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-[hsl(38_56%_60%)] bg-[hsl(var(--muted))]'
      }`}
    >
      <p className="text-[7px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p
        className={`mt-0.5 font-semibold ${
          small ? 'text-[11px]' : 'text-sm'
        } ${tone === 'green' ? 'text-emerald-700' : ''}`}
      >
        {value}
      </p>
    </div>
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
