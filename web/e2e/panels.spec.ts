import { expect, test, type Page } from '@playwright/test'

async function approve(page: Page) {
  const sheet = page.getByRole('dialog', { name: /^Confirm: / })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Approve and sign' }).click()
  await expect(page.getByText(/Confirmed in block \d+/)).toBeVisible()
  await page.getByRole('button', { name: 'Done' }).click()
}

test('S9 through the UI: buy and equip a hat, hit the Moonlit lock, buy it, open a Moonlit table', async ({ page }) => {
  await page.goto('/?dev&scn=s9')
  await page.getByRole('button', { name: "Tailor's wardrobe · Shop" }).click()
  const shop = page.getByRole('dialog', { name: "The tailor's wardrobe" })
  await expect(shop.getByRole('tab', { name: 'Hats' })).toHaveAttribute('aria-selected', 'true')
  await expect(shop.getByRole('article')).toHaveCount(12)

  await shop.getByRole('button', { name: 'Buy · 40 pts: Feather band' }).click()
  await approve(page)
  // Escape on the Confirm sheet must not close the shop below it
  await expect(shop).toBeVisible()
  await shop.getByRole('button', { name: 'Equip: Feather band' }).click()
  await approve(page)
  await expect(shop.getByRole('button', { name: 'Equipped · take off: Feather band' })).toBeVisible()

  // keyboard tabs
  await shop.getByRole('tab', { name: 'Hats' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(shop.getByRole('tab', { name: 'Outfits' })).toBeFocused()
  await expect(shop.getByRole('tab', { name: 'Outfits' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await expect(shop).toHaveCount(0)

  await page.getByRole('button', { name: '+ New table' }).click()
  const sheet = page.getByRole('dialog', { name: 'Open a new table' })
  await sheet.getByRole('button', { name: /Moonlit table/ }).click()
  await expect(sheet.getByRole('alert')).toContainText('Locked: the Moonlit table costs 150 points. You have 160.')
  await expect(sheet.getByRole('button', { name: 'Open table' })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Get it from the tailor' }).click()

  await expect(shop.getByRole('tab', { name: 'Table skins' })).toHaveAttribute('aria-selected', 'true')
  await shop.getByRole('button', { name: 'Buy · 150 pts: Moonlit table' }).click()
  await approve(page)
  await shop.getByRole('button', { name: 'Back to New table' }).click()
  await expect(sheet.getByRole('button', { name: /Moonlit table/ })).toHaveAttribute('aria-pressed', 'true')
  await sheet.getByRole('button', { name: 'Open table' }).click()
  await approve(page)
  await expect(page.getByRole('heading', { name: 'Quick table · Moonlit table' })).toBeVisible()
  await expect(page.getByText('Everyone at this table sees the Moonlit table.', { exact: true })).toBeVisible()
})

test('practice round in How to play ends with the chalk tally and the connect prompt', async ({ page }) => {
  await page.goto('/?dev&scn=s1')
  await page.getByRole('button', { name: 'Barkeep · How to play' }).click()
  const win = page.getByRole('dialog', { name: 'How to play' })
  await win.getByRole('button', { name: 'Start practice' }).click()
  await win.getByRole('spinbutton', { name: 'Number' }).fill('30')
  await win.getByRole('button', { name: 'Seal my practice slip' }).click()
  await expect(win.getByRole('list', { name: 'Practice seats' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __taproom: { session: { practiceSkip(ms: number): void } } }).__taproom.session.practiceSkip(18_000))
  await expect(win.getByRole('region', { name: 'Practice tally' })).toContainText('target')
  await win.getByRole('button', { name: 'Continue' }).click()
  await expect(win.getByText('Ready to play for the pot?')).toBeVisible()
})

test('Hall boards, My Regular and Settings open from the room', async ({ page }) => {
  await page.goto('/?dev&scn=s13')
  await page.getByRole('button', { name: 'Notice board · The Hall' }).click()
  const hall = page.getByRole('dialog', { name: 'The Hall' })
  await expect(hall.getByRole('table', { name: 'Net coins' }).getByRole('row').nth(1)).toContainText('Fennel')
  await hall.getByRole('tab', { name: 'Points' }).click()
  await expect(hall.getByRole('table', { name: 'Points' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Upstairs · My Regular' }).click()
  const reg = page.getByRole('dialog', { name: 'My Regular' })
  await expect(reg.getByText('Rank: Sharp')).toBeVisible()
  await reg.getByRole('button', { name: 'Withdraw 0.105 GNOT' }).click()
  await approve(page)
  await expect(reg.getByRole('button', { name: 'Withdraw 0 GNOT' })).toBeDisabled()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Guest ledger and settings' })
  await settings.getByRole('checkbox', { name: /Reduce motion/ }).check()
  await expect(page.locator('.app')).toHaveClass(/\brm\b/)
})
