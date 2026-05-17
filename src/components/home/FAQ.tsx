const ITEMS = [
  {
    q: 'How long does a Loveli Luxury fragrance last?',
    a: 'Eau de Parfum concentration. Expect 8–12 hours on skin and even longer on fabric, with a refined dry-down that softens through the day.',
  },
  {
    q: 'Is delivery available outside Nairobi?',
    a: 'Yes — we ship across Kenya and to neighbouring countries. Free delivery in Nairobi on orders above Kes 5,000.',
  },
  {
    q: 'Are these bottles refillable?',
    a: 'Each 30ml and 50ml bottle is designed to be cherished. Refill programs for our distributor partners launch in early 2026.',
  },
  {
    q: 'Can I become a distributor?',
    a: 'Only by invitation. An existing distributor sends you their sponsor link, you pay the registration fee and activate with a starter package. Earn retail profit on every bottle plus 7 levels of network commission (40% of point value). Climb 8 ranks: Starter, Team Builder, Builder, Manager, Senior Manager, Director, Senior Director, President. From Manager up, qualifying months earn a lifetime monthly salary — Kes 20,000 to Kes 250,000. Monthly stock maintenance is mandatory.',
  },
  {
    q: 'Are your fragrances tested on animals?',
    a: 'Never. Our blends are vegan-friendly and cruelty-free, and we work only with suppliers who hold the same standard.',
  },
] as const

export function FAQ() {
  return (
    <section
      id="faq"
      className="relative border-t border-[hsl(var(--border))]/60 py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <header className="mb-12 text-center">
          <p className="text-eyebrow">Quiet answers</p>
          <h2 className="mt-3 font-serif text-4xl tracking-tight md:text-5xl">
            Things people <em className="italic text-[hsl(var(--primary))]">ask</em>.
          </h2>
        </header>

        <div className="divide-y divide-[hsl(var(--border))]/60 border-y border-[hsl(var(--border))]/60">
          {ITEMS.map((item, i) => (
            <details
              key={item.q}
              {...(i === 0 ? { open: true } : {})}
              className="group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left transition hover:text-[hsl(var(--primary))]">
                <span className="font-serif text-lg md:text-xl">{item.q}</span>
                <span
                  aria-hidden
                  className="text-[hsl(var(--primary))] transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-6 pr-10 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
