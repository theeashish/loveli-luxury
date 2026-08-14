import { test, expect } from '@playwright/test'

const mobileViewports = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }] as const

for (const viewport of mobileViewports) {
  test(`mobile header keeps Partners inside the menu at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')

    const menuButton = page.getByRole('button', { name: 'Open menu' })
    const panel = page.locator('#mobile-menu-panel')

    await expect(menuButton).toBeVisible()
    await expect(page.getByTestId('mobile-header-actions').getByRole('link', { name: 'Partners', exact: true })).toHaveCount(0)
    

    await menuButton.click()
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Partners', exact: true })).toBeVisible()

    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.x)).toBe(0)
    expect(Math.round(box!.width)).toBe(viewport.width)
    expect(box!.height).toBeLessThanOrEqual(viewport.height - box!.y + 1)

    const panelClass = await panel.getAttribute('class')
    expect(panelClass).toContain('bg-[hsl(var(--background))]')
    expect(panelClass).not.toContain('/98')
  })
}
