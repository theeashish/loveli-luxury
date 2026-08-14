import { test, expect } from '@playwright/test'

test('desktop Sign up disclosure keeps authentication links grouped', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const authMenu = page.getByTestId('desktop-auth-menu')
  await expect(authMenu).toBeVisible()
  await expect(authMenu.locator('summary')).toContainText('Sign up')
  await expect(authMenu.getByRole('link', { name: 'Create account', exact: true })).not.toBeVisible()
  await expect(authMenu.getByRole('link', { name: 'Log in', exact: true })).not.toBeVisible()

  await authMenu.locator('summary').click()
  await expect(authMenu.getByRole('link', { name: 'Create account', exact: true })).toBeVisible()
  await expect(authMenu.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
})

test('mobile menu keeps explicit Log in and Sign up links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()

  const panel = page.locator('#mobile-menu-panel')
  await expect(panel.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Sign up', exact: true })).toBeVisible()
})
