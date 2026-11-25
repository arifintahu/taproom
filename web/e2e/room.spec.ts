import { expect, test } from '@playwright/test'

test('room renders on MockChain with hotspots, Places row and Barkeep', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'The taproom' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Quick table · \d+ of 10/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Places in the taproom' }).getByRole('button')).toHaveCount(8)
  await expect(page.getByText('Pull up a stool.')).toBeVisible()

  // a hotspot opens its window; Escape closes it and focus returns
  const hearth = page.getByRole('button', { name: 'Hearth · Weekly streak' })
  await hearth.click()
  await expect(page.getByRole('dialog', { name: 'Hearth' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(hearth).toBeFocused()

  // connect the simulated wallet
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click()
  await page.getByRole('button', { name: 'Approve connection' }).click()
  await expect(page.getByRole('button', { name: /^Wallet .* 5 GNOT$/ })).toBeVisible()
})

test('375 px: no page scroll, the room strip scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'The taproom' })).toBeVisible()
  const [doc, strip] = await page.evaluate(() => {
    const s = document.querySelector('.room-scroll')!
    return [document.documentElement.scrollWidth, s.scrollWidth - s.clientWidth]
  })
  expect(doc).toBe(375)
  expect(strip).toBeGreaterThan(0)
})
