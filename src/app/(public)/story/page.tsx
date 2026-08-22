import Link from 'next/link'

export const metadata = {
  title: 'Our Story | Loveli Luxury Scents',
  description:
    'A contemporary African fragrance house shaped by considered rituals, authentic scent, and the art of presence.',
  alternates: { canonical: '/story' },
}

const principles = [
  {
    index: '01',
    label: 'Origin',
    title: 'A house built close to home.',
    body: 'Loveli Luxury began with a simple belief: fragrance should recognise the life already around us. The warmth after rain, the stillness before an occasion, the familiar turn of a shoulder in a crowded room. Our point of view is contemporary African luxury: expressive, composed, and never borrowed from somebody else’s winter.',
  },
  {
    index: '02',
    label: 'Standard',
    title: 'The ritual starts with trust.',
    body: 'A beautiful bottle means very little if it cannot be trusted. We choose authorised supply channels, handle every order with care, and keep authenticity at the centre of the experience. It is a quiet discipline, but it is the one that lets every other detail matter.',
  },
  {
    index: '03',
    label: 'Intention',
    title: 'A scent should stay with you.',
    body: 'We curate fragrance for the moments that ask for a little more intention: a first introduction, an evening out, a gift chosen slowly, or the ordinary day you decide to make memorable. The collection is designed to be lived with, not simply displayed.',
  },
]

export default function StoryPage() {
  return (
    <article className="overflow-hidden">
      <section className="relative border-b border-[hsl(var(--border))]/70">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-[hsl(var(--primary))]/[0.07] blur-3xl" />
          <div className="absolute right-[-7rem] top-[-8rem] h-[30rem] w-[30rem] rounded-full border border-[hsl(var(--primary))]/15" />
          <div className="absolute right-[8%] top-[16%] h-24 w-24 rounded-full border border-[hsl(var(--primary))]/20" />
        </div>

        <div className="relative mx-auto grid min-h-[34rem] max-w-7xl items-end gap-12 px-6 py-20 md:grid-cols-[minmax(0,1fr)_22rem] md:py-28 lg:grid-cols-[minmax(0,1fr)_27rem]">
          <div className="max-w-3xl">
            <p className="text-eyebrow">The Loveli point of view</p>
            <h1 className="mt-6 font-serif text-5xl leading-[0.98] tracking-tight text-[hsl(var(--foreground))] sm:text-6xl md:text-7xl lg:text-[5.5rem]">
              Made for the way a room remembers you.
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              Loveli Luxury is a contemporary fragrance house shaped by the
              cities, rituals, and small gestures that make presence personal.
              We curate scent with an editorial eye and a deep respect for the
              person who wears it.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[10px] font-medium uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">
              <span>Nairobi, Kenya</span>
              <span className="h-1 w-1 rounded-full bg-[hsl(var(--primary))]" />
              <span>Fragrance, considered</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm self-center md:self-end">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm border border-[hsl(var(--primary))]/25 bg-[linear-gradient(145deg,hsl(var(--brand-charcoal))_0%,hsl(var(--brand-onyx))_58%,hsl(var(--primary))_180%)] p-5 shadow-[0_24px_60px_-34px_hsl(var(--foreground)/0.45)]">
              <div className="absolute inset-5 border border-[hsl(var(--primary))]/20" />
              <div className="absolute inset-x-0 top-[18%] h-px bg-[hsl(var(--primary))]/30" />
              <div className="absolute inset-x-0 bottom-[18%] h-px bg-[hsl(var(--primary))]/30" />
              <div className="relative flex h-full flex-col items-center justify-center text-center">
                <span className="font-serif text-7xl font-light italic tracking-tight text-[hsl(var(--primary))]/75 sm:text-8xl">
                  L
                </span>
                <span className="mt-4 text-[10px] font-medium uppercase tracking-[0.42em] text-[hsl(var(--foreground))]">
                  Loveli Luxury
                </span>
                <span className="mt-2 text-[9px] uppercase tracking-[0.28em] text-[hsl(var(--muted-foreground))]">
                  Scent as presence
                </span>
              </div>
            </div>
            <p className="mt-4 text-right text-[9px] uppercase tracking-[0.26em] text-[hsl(var(--muted-foreground))]">
              A study in memory
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="text-eyebrow">Our story</p>
            <h2 className="mt-5 max-w-sm font-serif text-4xl leading-tight tracking-tight md:text-5xl">
              Luxury, in a voice that feels like ours.
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-[hsl(var(--muted-foreground))]">
              We are interested in the details that create a lasting impression:
              the ceremony of choosing, the confidence of knowing, and the
              restraint to let a scent speak for itself.
            </p>
          </div>

          <div className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
            {principles.map((principle) => (
              <section key={principle.index} className="grid gap-5 py-10 md:grid-cols-[4.5rem_1fr] md:gap-8 md:py-12">
                <p className="pt-1 text-[11px] font-medium tracking-[0.2em] text-[hsl(var(--primary))]">
                  {principle.index}
                </p>
                <div>
                  <p className="text-eyebrow">{principle.label}</p>
                  <h3 className="mt-3 font-serif text-3xl leading-tight italic tracking-tight md:text-4xl">
                    {principle.title}
                  </h3>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
                    {principle.body}
                  </p>
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[hsl(var(--border))]/70 bg-[hsl(var(--brand-frost))]">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:py-20">
          <blockquote className="max-w-4xl font-serif text-3xl leading-tight italic tracking-tight text-[hsl(var(--foreground))] sm:text-4xl md:text-5xl">
            “A fragrance does not need to announce itself. It only needs to be
            remembered.”
          </blockquote>
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
            The Loveli standard
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
        <div className="grid gap-10 border border-[hsl(var(--primary))]/25 bg-[hsl(var(--brand-white))] p-8 shadow-[0_20px_48px_-38px_hsl(var(--foreground)/0.6)] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-12">
          <div className="max-w-2xl">
            <p className="text-eyebrow">Find your signature</p>
            <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight md:text-5xl">
              Begin with a scent that feels like you.
            </h2>
            <p className="mt-5 text-base leading-8 text-[hsl(var(--muted-foreground))]">
              Explore the collection at your own pace, or speak with our
              concierge when you would like a more considered introduction.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Link
              href="/shop"
              className="rounded-sm bg-[hsl(var(--brand-gold))] px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--brand-onyx))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--brand-onyx))] hover:text-[hsl(var(--brand-white))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            >
              Explore the collection
            </Link>
            <Link
              href="/policies/authenticity"
              className="rounded-sm border border-[hsl(var(--primary))]/45 px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--primary))]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            >
              Our authenticity promise
            </Link>
          </div>
        </div>
      </section>
    </article>
  )
}
