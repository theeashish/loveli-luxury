/**
 * Allow-list for the /api/revalidate route.
 *
 * The bearer-token check is the primary gate, but pinning the route to a known
 * set of catalog surfaces means a leaked token cannot be used to thrash the
 * full ISR cache or hit unrelated routes (admin pages, API routes, etc).
 *
 * Static surfaces are matched literally. Dynamic surfaces are matched by a
 * `/<prefix>/<slug>` shape where `<slug>` is the same character class enforced
 * by `slugSchema` in catalog/schemas.ts (lowercase a-z 0-9, single hyphens).
 */

const STATIC_PATHS: ReadonlySet<string> = new Set(['/', '/shop', '/bundles'])

const DYNAMIC_PREFIXES: readonly string[] = ['/p', '/bundles']

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type PathValidation =
  | { ok: true; path: string }
  | { ok: false; reason: string }

export function validateRevalidatePath(input: unknown): PathValidation {
  if (typeof input !== 'string') return { ok: false, reason: 'must be a string' }
  if (input.length === 0 || input.length > 256) return { ok: false, reason: 'length' }
  if (!input.startsWith('/')) return { ok: false, reason: 'must start with /' }
  if (input.includes('?') || input.includes('#') || input.includes('..')) {
    return { ok: false, reason: 'no query, fragment, or traversal' }
  }

  if (STATIC_PATHS.has(input)) return { ok: true, path: input }

  for (const prefix of DYNAMIC_PREFIXES) {
    if (!input.startsWith(`${prefix}/`)) continue
    const slug = input.slice(prefix.length + 1)
    if (slug.length === 0 || slug.length > 80) {
      return { ok: false, reason: 'slug length' }
    }
    if (!SLUG_RE.test(slug)) return { ok: false, reason: 'slug shape' }
    return { ok: true, path: input }
  }

  return { ok: false, reason: 'not in allow-list' }
}
