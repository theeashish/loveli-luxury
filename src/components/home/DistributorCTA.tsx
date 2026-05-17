import Link from 'next/link'

const STATS = [
  { v: '8', l: 'Ranks to climb' },
  { v: '7', l: 'Commission levels' },
  { v: '40%', l: 'Of PV paid out' },
  { v: '250k', l: 'Top monthly salary' },
] as const

export function DistributorCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 100%, hsl(38 56% 60% / 0.16) 0%, transparent 70%)',
        }}
      />
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-eyebrow">Join the family</p>
        <h2 className="mt-5 font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] tracking-tight">
          Wear the brand. <em className="italic text-[hsl(var(--primary))]">Build the dream</em>.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          Invite-only. Pay your registration, activate with a starter package, and maintain
          personal sales every month. Earn retail profit on every bottle plus commission across
          7 levels — and from Manager rank up, a lifetime monthly salary as high as
          Kes 250,000.
        </p>

        <ul className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-4 text-left text-sm text-[hsl(var(--muted-foreground))] sm:grid-cols-4">
          {STATS.map((s) => (
            <li key={s.l} className="text-center">
              <p className="font-serif text-3xl text-[hsl(var(--primary))]">{s.v}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em]">{s.l}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12">
          <Link
            href="/boss-scents"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--primary))] px-10 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary-foreground))] transition hover:scale-[1.02]"
          >
            <span className="relative z-10">Explore Boss Scents</span>
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </Link>
        </div>
      </div>
    </section>
  )
}
