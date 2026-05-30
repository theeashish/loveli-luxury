import Link from 'next/link'

const STATS = [
  { v: '5', l: 'Partner ranks' },
  { v: 'Invite-only', l: 'Access' },
  { v: 'Quarterly', l: 'Performance reviews' },
  { v: 'Editorial', l: 'Brand access' },
] as const

export function DistributorCTA() {
  return (
    <section className="relative overflow-hidden border-t border-[hsl(var(--border))]/60 py-28 md:py-40 lg:py-48">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 100%, hsl(38 40% 60% / 0.16) 0%, transparent 70%)',
        }}
      />
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-eyebrow">Partner program</p>
        <h2 className="mt-5 font-serif text-[clamp(2.25rem,5vw,4rem)] leading-[1.05] tracking-tight">
          Wear the brand. <em className="italic text-[hsl(var(--primary))]">Build a luxury fragrance business</em>.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          Invite-only. Five ranks, each tied to verified retail performance.
          Begin as an Ambassador and progress through Executive, Gold Director,
          Platinum Director, and Crown President. Richer earnings, regional
          access, limited-edition allocation. Retention bonuses reviewed
          quarterly, tied to real sales.
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
            href="/partners"
            className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--foreground))] px-10 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:scale-[1.02]"
          >
            <span className="relative z-10">Explore the partner program</span>
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
          </Link>
        </div>
      </div>
    </section>
  )
}
