import { test, expect } from '@playwright/test'

test('Scent Finder advances with an explicit ritual progress state', async ({ page }) => {
  await page.goto('/#scent-finder')
  const finder = page.locator('section').filter({ hasText: 'A small ritual' }).last()
  await expect(finder).toContainText('Question 1 of 3')
  await expect(finder.locator('[aria-label="Question 1 of 3"]')).toBeVisible()
  await finder.getByRole('button', { name: 'Quietly, but unforgettably' }).click()
  await expect(finder).toContainText('Pick a time of day:')
  await expect(finder.locator('[aria-label="Question 2 of 3"]')).toBeVisible()
})

test('mobile storefront keeps navigation and Scent Finder entry usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const menuButton = page.getByRole('button', { name: 'Open menu' })
  await expect(menuButton).toBeVisible()
  await menuButton.click()
  await expect(page.locator('#mobile-menu-panel')).toBeVisible()
  await expect(page.locator('#mobile-menu-panel').getByRole('link', { name: 'Shop', exact: true })).toBeVisible()
  await page.goto('/#scent-finder')
  await expect(page.getByText('Question 1 of 3')).toBeVisible()
})
