/**
 * /story — founder + brand narrative.
 *
 * Editorial layout. Single column on mobile, two-column on desktop
 * (image left, copy right). Conservative draft copy marked as a
 * placeholder ribbon until the owner edits this file and replaces it.
 *
 * Restraint: no testimonials, no logo wall, no busy "as seen in"
 * strip. One quote pull, one closing CTA.
 */

import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Story — Loveli Luxury',
  description:
    'Modern African luxury, told in scent. The story behind Loveli Luxury.',
}

// Flip to true once the owner has finalised the copy below. While
// false, a small "[draft]" ribbon shows in the top-right of the
// founder portrait so customers know the founder content is provisional.
const COPY_IS_FINAL = false

export default function StoryPage() {
  return (
    <article className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <header className="mb-16">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[hsl(var(--primary))]">
          About Loveli Luxury
        </p>
        <h1 className="mt-3 max-w-2xl font-serif text-5xl tracking-tight md:text-6xl">
          Modern African luxury, told in scent.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
          The home of modern African luxury fragrance culture — built for the
          customer who notices the smaller things, and remembers them.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-[20rem_1fr] md:gap-20">
        <aside className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[hsl(var(--primary))]/15 bg-[hsl(var(--muted))]/40">
            {/* Founder portrait placeholder. Owner replaces with a real
                portrait (4:5 ratio recommended) under public/images/
                and updates the src here. */}
            <Image
              src="/placeholder-founder.jpg"
              alt="Founder of Loveli Luxury"
              fill
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-cover"
              priority={false}
            />
            {!COPY_IS_FINAL ? (
              <span className="absolute right-3 top-3 rounded-sm border border-[hsl(var(--primary))]/40 bg-[hsl(var(--background))]/90 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--primary))]">
                Draft — owner review pending
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
            Founder
          </p>
          <p className="mt-1 text-base text-[hsl(var(--foreground))]">
            Ashish Iruma Abala
          </p>
          <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            Founder + Curator
          </p>
        </aside>

        <div className="space-y-12">
          <section>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Origin
            </p>
            <h2 className="mt-2 font-serif text-2xl italic md:text-3xl">
              We started because nobody was telling our story in scent.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
              Loveli Luxury was founded out of a simple frustration: the global
              luxury fragrance houses do not speak to who we are or where we
              live. They sell ideas of glamour borrowed from someone else's
              winter. We wanted something that recognised our cities, our
              ceremonies, our shoulders, our nights. Fragrance built for
              presence here, in Nairobi, in Mombasa, in Kakamega — not exported
              and softened along the way.
            </p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Craft
            </p>
            <h2 className="mt-2 font-serif text-2xl italic md:text-3xl">
              Authenticity comes before everything.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
              Counterfeit perfume is a real problem in our region, and any
              brand pretending otherwise is selling a fantasy. Every bottle on
              our shelves comes from authorised channels, arrives with house
              documentation, is stored under controlled conditions, and ships
              tamper-banded. We over-engineer this part of the operation
              because the alternative — selling a bottle whose chemistry has
              been altered or fabricated — destroys the trust this whole
              category depends on.
            </p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
              Where we're going
            </p>
            <h2 className="mt-2 font-serif text-2xl italic md:text-3xl">
              A fragrance ecosystem, not a perfume shop.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
              The catalogue is the first surface. Behind it: a partner program
              for the people who already live this culture — creators,
              stylists, regional curators, hosts — and an education layer that
              treats fragrance as the craft it is. We're building Loveli Luxury
              to outlast the trend cycle. Slow growth, real relationships,
              fragrance that finishes the way it begins.
            </p>
          </section>

          <blockquote className="border-l-2 border-[hsl(var(--primary))]/50 pl-6 font-serif text-2xl italic leading-relaxed text-[hsl(var(--foreground))] md:text-3xl">
            "We are not selling perfume. We are selling presence — and the
            confidence to leave it behind on a room."
          </blockquote>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link
              href="/shop"
              className="rounded-md bg-[hsl(var(--foreground))] px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
            >
              Explore the collection
            </Link>
            <Link
              href="/boss-scents"
              className="rounded-md border border-[hsl(var(--primary))]/40 px-8 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
            >
              The partner program
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
