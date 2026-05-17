/**
 * Default sponsor — the founding distributor's sponsor_code.
 *
 * Used to attribute SEO / direct / orphan traffic. Every visitor without
 * a ?ref= param and no existing ll_sponsor cookie gets credited to this
 * sponsor so every downstream order has commission attribution.
 *
 * Backed by public.default_sponsor_code() (migration 021), a SECURITY
 * DEFINER RPC that bypasses RLS to return just the founder's
 * sponsor_code — no other distributor data.
 *
 * Module-level cache with a 5-minute TTL. The founder almost never
 * changes; refreshing every five minutes is cheap and bounded. Cold
 * starts (server restart, edge worker recycle) naturally reset it.
 */

let cached: { code: string | null; at: number } | null = null
const TTL_MS = 5 * 60 * 1000

/**
 * Returns the founding distributor's sponsor_code, or null if no
 * founder has been bootstrapped yet (transitional pre-bootstrap state)
 * or the RPC is unavailable (migration 021 not yet applied).
 *
 * Accepts any Supabase client (server, ssr, or service). We cast through
 * `unknown` so the call site doesn't need its `Database` generic to
 * already know about the new RPC — TODO(types): regenerate database.ts
 * after migration 021 lands to drop the cast.
 */
export async function getDefaultSponsorCode(
  client: unknown,
): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.code

  const typed = client as {
    rpc: (
      fn: 'default_sponsor_code',
    ) => Promise<{
      data: string | null
      error: { message: string } | null
    }>
  }

  const { data, error } = await typed.rpc('default_sponsor_code')
  if (error) {
    // Don't cache the failure — a freshly-applied migration or
    // freshly-bootstrapped founder should be picked up on the next request.
    return null
  }

  const code = data ?? null
  cached = { code, at: Date.now() }
  return code
}

/** Invalidate the cache. Exposed for tests + admin actions. */
export function invalidateDefaultSponsorCache(): void {
  cached = null
}
