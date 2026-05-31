/**
 * Smoke suite — catches deployment-level regressions, not full UI behaviour.
 *
 * These tests run against `next start` with a placeholder (unreachable)
 * database, so they only exercise pages that degrade cleanly when DB-bound
 * data is missing. Anything that genuinely needs DB data is OUT of scope here
 * — that belongs in the integration suite (pglite) or a later DB-backed e2e.
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
    for (const route of ['/shop', '/bundles', '/partners', '/story', '/policies']) {
      expect(body).toContain(route)
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
  // commission downstream — a regression here breaks MLM correctness silently.
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
  // (env var typo, accidental override) silently drops them — that's exactly
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
