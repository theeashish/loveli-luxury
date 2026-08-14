import { test, expect } from '@playwright/test'

test('desktop Create account link keeps Log in in the secondary menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const authMenu = page.getByTestId('desktop-auth-menu')
  const createAccount = authMenu.getByRole('link', { name: 'Create account', exact: true })
  const login = authMenu.getByRole('link', { name: 'Log in', exact: true })

  await expect(createAccount).toBeVisible()
  await expect(createAccount).toHaveAttribute('href', '/signup')
  await expect(login).not.toBeVisible()

  await createAccount.hover()
  await expect(login).toBeVisible()
  await expect(login).toHaveAttribute('href', '/login')
})

test('mobile menu keeps explicit Log in and Sign up links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()

  const panel = page.locator('#mobile-menu-panel')
  await expect(panel.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Sign up', exact: true })).toBeVisible()
})
