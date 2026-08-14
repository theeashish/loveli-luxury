import { expect, test } from '@playwright/test'

test('Partner Agreement preserves the established programme clauses without visitor-facing internal review language', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/partners/agreement')

  await expect(page.getByRole('heading', { level: 1, name: 'Partner Agreement' })).toBeVisible()
  await expect(page.getByText('DRAFT FOR LEGAL REVIEW ONLY', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Draft for legal review only', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Draft 0.1', { exact: false })).toHaveCount(0)
  await expect(page.getByText('legal review required', { exact: false })).toHaveCount(0)

  const contents = page.getByRole('navigation', { name: 'Agreement contents' })
  await expect(contents).toBeVisible()
  await expect(contents.locator('a[href="#4-retail-first-business-model-and-compensation"]')).toBeVisible()
  await expect(contents.locator('a[href="#10-suspension-termination-and-consequences"]')).toBeVisible()

  await expect(page.getByRole('heading', { level: 2, name: '4. Retail-first business model and compensation' })).toBeVisible()
  await expect(page.getByText('The programme is retail-first.', { exact: false })).toBeVisible()
  await expect(page.getByText('A prospective partner may be asked to select and pay for a Starter package.', { exact: false })).toBeVisible()
  await expect(page.getByText('25% below the retail price', { exact: false })).toBeVisible()
  await expect(page.getByText('M-Pesa payouts', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Income Disclosure Statement' }).first()).toHaveAttribute('href', '/ids')
})

test('Partner Agreement remains readable and navigable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/partners/agreement')

  await expect(page.getByRole('heading', { level: 1, name: 'Partner Agreement' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Agreement contents' })).toBeVisible()
  await expect(page.locator('a[href="#5-prices-wholesale-access-and-customer-treatment"]')).toBeVisible()
  await expect(page.getByText('Draft for legal review only', { exact: false })).toHaveCount(0)
})
