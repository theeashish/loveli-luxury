/**
 * Social proof — press & creator features (brand brief homepage section #9).
 *
 * DB-backed + admin-managed via /admin/content/social-proof (migration 026).
 * Renders nothing until there is at least one published press feature — no
 * fabricated logos ship. Add real features (publication / creator name +
 * optional link) in the admin and the band appears.
 */

import { getPublishedPress } from '@/lib/home/social-proof'

export async function SocialProof() {
  const press = (await getPublishedPress()) ?? []
  if (press.length === 0) return null

  return (
    <section
      aria-label="As featured"
      className="border-t border-[hsl(var(--border))]/60 py-24 md:py-32 lg:py-40"
    >
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-eyebrow">As featured</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {press.map((f) =>
            f.url ? (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-xl tracking-wide text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--primary))]"
              >
                {f.name}
              </a>
            ) : (
              <span
                key={f.id}
                className="font-serif text-xl tracking-wide text-[hsl(var(--muted-foreground))]"
              >
                {f.name}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
