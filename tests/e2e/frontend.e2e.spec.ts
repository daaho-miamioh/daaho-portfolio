import { expect, test } from '@playwright/test'

test.describe('Public site', () => {
  test('home page names the project', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/Documenting Asian American Histories in Ohio/)
    await expect(page.locator('h1').first()).toHaveText('Documenting Asian American Histories in Ohio')
  })

  test('an unpublished item is not reachable by the public', async ({ page }) => {
    const res = await page.goto('http://localhost:3000/items/aamu-0001')
    expect(res?.status()).toBe(404)
  })
})
