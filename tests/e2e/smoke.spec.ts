
/**
 * Smoke suite â€” catches deployment-level regressions, not full UI behaviour.
 *
 * These tests run against `next start` with a placeholder (unreachable)
 * database, so they only exercise pages that degrade cleanly when DB-bound
 * data is missing. Anything that genuinely needs DB data is OUT of scope here
 * â€” that belongs in the integration suite (pglite) or a later DB-backed e2e.
 */
import { test, expect } from '@playwright/test'

test.describe('public surfaces render', () => {
  test('/ returns 200 and ships Organization + WebSite JSON-LD', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    // The structured-data we added (commit 0c66895). Catches a regression that
    // silently drops the homepage's brand SERP eligibility.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(ld).toBeTruthy()
    const parsed = JSON.parse(ld as string)
    const graph: Array<{ '@type': string }> = parsed['@graph'] ?? []
    const types = graph.map((g) => g['@type'])
    expect(types).toEqual(expect.arrayContaining(['Organization', 'WebSite']))
  })

  test('/partners renders the program landing (no rates, by design)', async ({ page }) => {
    const res = await page.goto('/partners')
    expect(res?.status()).toBe(200)
    // Privacy rule (masterplan Appendix C): no commission rates on the public
    // page; they live behind /account/partner/earnings. A regression that
    // leaks "20%" or "11%" onto /partners is a brand+legal issue.
    const body = await page.locator('body').textContent()
    expect(body?.toLowerCase()).toContain('partner')
    expect(body).not.toMatch(/\b20%\b.*(direct|level|commission)/i)
  })

  test('/policies/{authenticity,delivery,refund} render', async ({ page }) => {
    for (const path of ['/policies/authenticity', '/policies/delivery', '/policies/refund']) {
      const res = await page.goto(path)
      expect(res?.status(), `${path} status`).toBe(200)
    }
  })

  test('/ids renders the Income Disclosure Statement with the locked rules', async ({ page }) => {
    const res = await page.goto('/ids')
    expect(res?.status()).toBe(200)
    const body = (await page.locator('body').textContent()) ?? ''
    // The non-negotiable rules from the locked design (lib/content/site.ts).
    // A regression that softens or drops these is a legal-exposure risk.
    expect(body).toContain('Commissions are paid only on confirmed retail sales')
    expect(body).toContain('Recruiting a partner does not earn commission')
    expect(body).toContain('Your own Starter package purchase does not earn commission')
    expect(body).toContain('If an order is refunded, any related commission is taken from a later payout')
    expect(body).toContain('No income is guaranteed')
  })

  test('/api/health (liveness) returns 200', async ({ request }) => {
    // This is the endpoint our external uptime monitor pings every minute.
    // A regression that breaks it = blind monitoring = silent outage.
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.mode).toBe('liveness')
  })

  test('/api/cron/heartbeat refuses anonymous requests with 401', async ({ request }) => {
    // The internal Sentry heartbeat cron is bearer-gated. Anonymous access
    // must NOT trigger a Sentry check-in (that would silence the missed-
    // check-in alert by spamming "ok" on every drive-by request). Regression
    // here = compromised liveness alerting.
    const res = await request.get('/api/cron/heartbeat')
    expect([401, 500]).toContain(res.status()) // 500 only if CRON_SECRET unset in test env
  })

  test('robots.txt allows / and disallows private routes', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toMatch(/Allow:\s*\//)
    expect(body).toMatch(/Disallow:\s*\/admin/)
    expect(body).toMatch(/Disallow:\s*\/account/)
    expect(body).toMatch(/Disallow:\s*\/api/)
  })

  test('sitemap.xml is well-formed and lists key public routes', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    // Static routes from sitemap.ts STATIC_PATHS.
    for (const route of ['/shop', '/partners', '/story', '/policies']) {
      expect(body).toContain(route)
    }
  })

  test('indexable marketing routes emit a self-referential canonical', async ({ request }) => {
    // SEO regression guard. The 2026-06-03 pass added explicit canonicals to
    // every indexable route (previously only PDP + /ids set them). If a future
    // metadata edit silently drops `alternates.canonical`, Google sees the
    // route as duplicate-content-risk.
    const expected: Record<string, string> = {
      '/': '/',
      '/shop': '/shop',
      '/partners': '/partners',
      '/story': '/story',
      '/policies/authenticity': '/policies/authenticity',
      '/policies/delivery': '/policies/delivery',
      '/policies/refund': '/policies/refund',
      '/ids': '/ids',
    }
    // GitHub Actions deliberately uses a non-routable Supabase hostname so CI
    // never reaches a real database. These routes load catalog or CMS content
    // at request time, so their HTTP canonical rendering belongs to the staging
    // test; keep this CI check focused on routes that render without Supabase.
    const usesPlaceholderSupabase =
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co'
    const routes = Object.entries(expected).filter(
      ([route]) => !usesPlaceholderSupabase || !['/shop', '/partners', '/policies/authenticity', '/policies/delivery', '/policies/refund', '/ids'].includes(route),
    )

    for (const [route, expectedPath] of routes) {
      // A canonical tag is server-rendered metadata. Assert it from the raw
      // HTML response instead of driving Chromium through every page's client
      // resource lifecycle. This removes the intermittent frame-detach failure
      // seen when navigating to /story in CI, while still testing the exact
      // canonical tag search engines receive.
      const response = await request.get(route)
      expect(response.status(), `${route} status`).toBe(200)
      const html = await response.text()
      const canonicalTag = html.match(
        /<link\b[^>]*\brel=["']canonical["'][^>]*>/i,
      )?.[0]
      const href = canonicalTag?.match(/\bhref=["']([^"']+)["']/i)?.[1]
      expect(href, `canonical on ${route}`).toBeTruthy()
      // Next.js's own URL resolver (resolveAbsoluteUrlWithPathname in
      // next/dist/lib/metadata/resolvers/resolve-url.js) deliberately
      // returns the bare origin with NO trailing slash for the root path
      // specifically, unless `trailingSlash: true` is set in
      // next.config.js (it isn't, here). Stripping a trailing '/' from
      // expectedPath before building the regex makes the trailing slash
      // truly optional for every route, root included, instead of
      // accidentally requiring one only for '/'.
      const canonicalPath = new URL(href as string, 'http://127.0.0.1:3000').pathname
      const expectedCanonicalPath = expectedPath === '/' ? '/' : expectedPath.replace(/\/$/, '')
      expect(canonicalPath, `canonical on ${route} should match ${expectedPath}`).toBe(
        expectedCanonicalPath,
      )
    }
  })
})

test.describe('auth-gated routes redirect unauthenticated users', () => {
  // src/middleware.ts redirects /account, /checkout, /partners/signup to /login.
  for (const path of [
    '/account',
    '/account/partner',
    '/account/partner/earnings',
    '/checkout',
    '/partners/signup',
  ]) {
    test(`${path} -> /login when anonymous`, async ({ page }) => {
      await page.goto(path)
      // After the middleware redirect lands, URL is /login?next=<original>.
      await expect(page).toHaveURL(/\/login\b/, { timeout: 5_000 })
    })
  }

  test('/admin -> /login when anonymous', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login\b/)
  })
})

test.describe('sponsor-cookie attribution (first-touch MLM input)', () => {
  // The middleware sets the ll_sponsor cookie on any visit with ?ref=LL-XX-XXXX
  // matching the SPONSOR_CODE_RE pattern. This is the entry point for every
  // commission downstream â€” a regression here breaks MLM correctness silently.
  test('?ref=LL-AB-CDEF sets the ll_sponsor cookie for 30 days', async ({ page, context }) => {
    await page.goto('/?ref=LL-AB-CDEF')
    const cookies = await context.cookies()
    const sponsor = cookies.find((c) => c.name === 'll_sponsor')
    expect(sponsor, 'll_sponsor cookie should be set').toBeDefined()
    expect(sponsor!.value).toBe('LL-AB-CDEF')
    expect(sponsor!.httpOnly).toBe(true)
    expect(sponsor!.sameSite).toBe('Lax')
  })

  test('malformed ?ref=NOT-A-CODE does NOT set ll_sponsor', async ({ page, context }) => {
    await page.goto('/?ref=NOT-A-CODE')
    const cookies = await context.cookies()
    const sponsor = cookies.find((c) => c.name === 'll_sponsor' && c.value === 'NOT-A-CODE')
    expect(sponsor).toBeUndefined()
  })
})

test.describe('security headers (strict CSP / HSTS / frame deny)', () => {
  // next.config.js sets these on every response. A misconfigured deploy
  // (env var typo, accidental override) silently drops them â€” that's exactly
  // what a smoke suite should catch before it reaches production.
  test('homepage carries the documented security headers', async ({ request }) => {
    const res = await request.get('/')
    const headers = res.headers()
    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['strict-transport-security']).toContain('max-age=63072000')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })
})
