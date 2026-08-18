import { expect, test } from '@playwright/test'

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const

const routes = [
  { name: 'home', path: '/' },
  { name: 'shop', path: '/shop' },
  { name: 'partners', path: '/partners' },
  { name: 'story', path: '/story' },
  { name: 'delivery-policy', path: '/policies/delivery' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/signup' },
  { name: 'cart', path: '/cart' },
  { name: 'track', path: '/track' },
] as const

for (const viewport of viewports) {
  test.describe(`${viewport.name} visual baselines`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    for (const route of routes) {
      test(`matches ${route.name}`, async ({ page }) => {
        const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
        expect(response?.status(), `${route.path} should render successfully`).toBe(200)
        await page.waitForTimeout(250)
        await expect(page).toHaveScreenshot(`${viewport.name}/${route.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          mask: [page.locator('aside[aria-label="Concierge support"]')],
          scale: 'css',
          maxDiffPixels: 200,
        })
      })
    }
  })
}
