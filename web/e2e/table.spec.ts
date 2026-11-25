import { expect, test, type Page } from '@playwright/test'

type Dev = { mock: { rounds: { id: number }[]; skipTo(id: number, to: 'reveal' | 'settle'): void } }
const skip = (page: Page, to: 'reveal' | 'settle') =>
  page.evaluate((t) => (window as unknown as { __taproom: Dev }).__taproom.mock.skipTo(0, t), to)

/** Approve the Confirm sheet that a write opens, then close it. */
async function confirm(page: Page, title: RegExp) {
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
  // the title drops "Confirm:" once approved, so follow the one open dialog
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Approve and sign' }).click()
  await expect(sheet.getByText(/Confirmed in block \d+/)).toBeVisible()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test('S2 through the UI: seal 22, reveal, settle, claim 2.985 GNOT', async ({ page }) => {
  await page.goto('/?dev&scn=s2')
  await page.getByRole('button', { name: /^Quick table · 2 of 10/ }).click()
  await expect(page.getByRole('heading', { name: 'Quick table · Oak table' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Money breakdown' })).toContainText('2.985 GNOT')

  // number picker: typing, plus/minus and the slider stay in sync
  const num = page.getByRole('spinbutton', { name: 'Number' })
  await num.fill('21')
  await page.getByRole('button', { name: 'Raise by one' }).click()
  await expect(num).toHaveValue('22')
  await expect(page.getByRole('slider', { name: 'Your number' })).toHaveValue('22')
  await num.fill('101')
  await expect(page.getByRole('alert')).toHaveText('Enter a whole number from 0 to 100.')
  await expect(page.getByRole('button', { name: 'Seal my pick · pay 1 GNOT' })).toBeDisabled()
  await num.fill('22')

  await page.getByRole('button', { name: 'Seal my pick · pay 1 GNOT' }).click()
  const sheet = page.getByRole('dialog', { name: /Confirm: Join the table/ })
  await expect(sheet).toContainText('Winner receives')
  await expect(sheet).toContainText('2.985 GNOT')
  await confirm(page, /Confirm: Join the table/)
  await expect(page.getByRole('heading', { name: 'Your slip is sealed: 22' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Wallet .* 4 GNOT$/ })).toBeVisible()

  await skip(page, 'reveal')
  await page.getByRole('button', { name: 'Reveal my pick' }).click()
  await confirm(page, /Confirm: Reveal your pick/)
  await expect(page.getByText('Revealed 22. Waiting for the others.')).toBeVisible()

  await skip(page, 'settle')
  await page.getByRole('button', { name: 'Settle the round' }).click()
  await confirm(page, /Confirm: Settle the round/)
  await expect(page.getByRole('heading', { name: 'You won 2.985 GNOT' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Chalk tally' })).toContainText('target 23.33')
  await expect(page.getByRole('region', { name: 'Your move' }).getByText('+34 points')).toBeVisible()

  await page.getByRole('button', { name: 'Claim 2.985 GNOT' }).click()
  await confirm(page, /Confirm: Claim your winnings/)
  await expect(page.getByText('Claimed 2.985 GNOT to your pouch.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Wallet .* 6.985 GNOT$/ })).toBeVisible()
})

test('S10d: rejecting in the Confirm sheet sends nothing', async ({ page }) => {
  await page.goto('/?dev&scn=s10d')
  await page.getByRole('button', { name: /^Quick table/ }).first().click()
  await page.getByRole('button', { name: 'Seal my pick · pay 1 GNOT' }).click()
  await expect(page.getByRole('dialog', { name: /Confirm: Join the table/ })).toBeVisible()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Reject' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Nothing was sent and your pick is not sealed')
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Seal my pick · pay 1 GNOT' })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^Wallet .* 5 GNOT$/ })).toBeVisible()
})

test('S10e: a failed transaction shows the chain reason and retries', async ({ page }) => {
  await page.goto('/?dev&scn=s10e')
  await page.getByRole('button', { name: /^Quick table/ }).first().click()
  await page.getByRole('button', { name: 'Seal my pick · pay 1 GNOT' }).click()
  const sheet = page.getByRole('dialog', { name: /Join the table/ })
  await sheet.getByRole('button', { name: 'Approve and sign' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Transaction failed: the commit window closed')
  await sheet.getByRole('button', { name: 'Try again' }).click()
  await confirm(page, /Confirm: Join the table/)
  await expect(page.getByRole('heading', { name: /Your slip is sealed/ })).toBeVisible()
})
