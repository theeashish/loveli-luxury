import Link from "next/link";
import { getSection } from "@/lib/content/site";
import { HighlightText } from "@/components/content/HighlightText";
import { EditorialPhotoFrame } from "@/components/editorial/EditorialPhotoFrame";

export const metadata = {
  title: "Partner Program | Loveli Luxury Scents",
  description:
    "Discover the Loveli Luxury partner programme for creators, resellers, and regional curators of modern African fragrance.",
  alternates: { canonical: "/partners" },
};

export default async function PartnerProgramPage() {
  const [hero, program] = await Promise.all([
    getSection("partner_landing"),
    getSection("partner_program"),
  ]);

  return (
    <div data-page="partners">
      <section className="relative overflow-hidden border-b border-[hsl(var(--brand-gold))]/30 bg-[hsl(var(--brand-onyx))] text-[hsl(var(--brand-white))]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="absolute -left-28 top-4 h-96 w-96 rounded-full bg-[hsl(var(--primary))]/[0.07] blur-3xl" />
          <div className="absolute right-[6%] top-[-10rem] h-[31rem] w-[31rem] rounded-full border border-[hsl(var(--primary))]/15" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-16 md:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.64fr)] md:items-end md:py-24">
          <div className="max-w-3xl">
            <p className="text-eyebrow text-[hsl(var(--brand-gold))]">{hero.eyebrow}</p>
            <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-tight text-[hsl(var(--brand-white))] md:text-6xl lg:text-7xl">
              <HighlightText text={hero.headline} />
            </h1>
            <p className="mt-7 text-[10px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--primary))]">
              {hero.microtag}
            </p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--brand-silver))] md:text-lg">
              {hero.subhead}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/partners/signup"
                className="rounded-sm bg-[hsl(var(--brand-gold))] px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--brand-onyx))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--brand-white))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
              >
                {hero.ctaLabel}
              </Link>
              <Link
                href="/partners/agreement"
                className="px-2 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--primary))] underline-offset-8 transition hover:underline"
              >
                Discover the programme
              </Link>
            </div>
            <p className="mt-6 text-[9px] uppercase tracking-[0.26em] text-[hsl(var(--brand-silver))]">
              {hero.inviteNote}
            </p>
          </div>

          <EditorialPhotoFrame
            src={program.photo.heroUrl}
            alt={program.photo.heroAlt}
            label="The partner programme"
            caption={program.photo.heroCaption}
            monogram="LP"
            className="mx-auto w-full max-w-sm"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-[minmax(17rem,0.74fr)_minmax(0,1.26fr)] md:items-center lg:gap-24">
          <div>
            <p className="text-eyebrow">A fragrance house worth discovering</p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              Built for people who notice the difference.
            </h2>
          </div>
          <div className="border-y border-[hsl(var(--border))] py-8 md:py-10">
            <p className="max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              Loveli Luxury brings together modern African fragrance, considered
              presentation, and a partner programme for creators, resellers, and
              regional curators.
            </p>
            <p className="mt-6 max-w-3xl font-serif text-2xl italic leading-tight text-[hsl(var(--foreground))] md:text-3xl">
              The full story is shared with invited partners.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-3 md:gap-12 md:py-20">
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
              01
            </p>
            <h2 className="mt-4 font-serif text-3xl tracking-tight text-[hsl(var(--foreground))]">
              Discover
            </h2>
            <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              Meet a fragrance collection designed to leave a memorable first
              impression.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
              02
            </p>
            <h2 className="mt-4 font-serif text-3xl tracking-tight text-[hsl(var(--foreground))]">
              Curate
            </h2>
            <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              Share the house with people who value detail, ritual, and
              distinction.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
              03
            </p>
            <h2 className="mt-4 font-serif text-3xl tracking-tight text-[hsl(var(--foreground))]">
              Begin
            </h2>
            <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              Request an invitation and learn whether the partner journey is
              right for you.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-[minmax(17rem,0.74fr)_minmax(0,1.26fr)] md:items-center lg:gap-24">
          <EditorialPhotoFrame
            src={program.photo.storiesUrl}
            alt={program.photo.storiesAlt}
            label="Life around the programme"
            caption={program.photo.storiesCaption}
            monogram="ST"
            className="mx-auto w-full max-w-sm md:mx-0"
          />
          <div>
            <p className="text-eyebrow">A considered beginning</p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
              Some doors are better opened slowly.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
              Explore the house, read the partner agreement, and decide whether
              Loveli Luxury belongs in your next chapter.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/partners/signup"
                className="rounded-sm bg-[hsl(var(--brand-gold))] px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--brand-onyx))] transition duration-200 hover:-translate-y-0.5 hover:bg-[hsl(var(--brand-white))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
              >
                {hero.ctaLabel}
              </Link>
              <Link
                href="/partners/agreement"
                className="rounded-sm border border-[hsl(var(--primary))]/45 px-7 py-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
              >
                Read the agreement
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
