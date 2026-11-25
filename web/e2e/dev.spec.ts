import { expect, test, type Page } from '@playwright/test'

const IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10a', 's10b', 's10c', 's10d', 's10e', 's10f', 's11', 's12', 's13']

async function finish(page: Page) {
  const status = page.locator('.dev-guide-text p.h')
  const next = page.getByRole('button', { name: 'Next', exact: true })
  for (let i = 0; i < 30; i++) {
    if ((await status.textContent())?.startsWith('Done:')) return
    if (await next.isEnabled()) await next.click()
    await page.waitForTimeout(150)
  }
  await expect(status).toHaveText(/^Done: all \d+ steps/)
}

test('dev bar: guided S2 pulses the target, then Next completes it', async ({ page }) => {
  await page.goto('/?dev&scn=s2')
  await expect(page.getByRole('toolbar', { name: 'Simulation controls' })).toBeVisible()
  await expect(page.getByText('Step 1 of 9: Open the Quick table')).toBeVisible()
  // the first table hotspot carries the teal pulse
  const hotspot = page.locator('[data-tg="openTable"]')
  await expect(hotspot).toHaveCSS('outline-color', 'rgb(79, 209, 181)')
  await finish(page)
  await expect(page.getByRole('dialog', { name: 'My Regular' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Scenario progress' })).toHaveAttribute('aria-valuenow', '9')
})

test('dev bar: every scenario reaches its last step through the UI', async ({ page }) => {
  test.setTimeout(180_000)
  await page.goto('/?dev&scn=s1')
  const pick = page.getByRole('combobox', { name: 'Scenario' })
  for (const id of IDS) {
    await pick.selectOption(id)
    await expect(page.locator('.dev-guide-text p.h')).toHaveText(/^(Step 1 of|Done:)/)
    await finish(page)
    // close anything the scenario left open before the next one
    await page.keyboard.press('Escape')
  }
})

test('dev bar: Back, free mode, clock, device width and motion', async ({ page }) => {
  await page.goto('/?dev&scn=s2')
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.click()
  await next.click()
  await expect(page.getByText(/^Step [34] of 9/)).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByText(/^Step [23] of 9/)).toBeVisible()

  await page.getByRole('button', { name: 'Free', exact: true }).click()
  await expect(page.locator('.dev-guide')).toHaveCount(0)
  await expect(page.getByText(/^S2 · 5 GNOT in the wallet/)).toBeVisible()

  const clock = page.getByLabel('Simulated chain time')
  const before = await clock.textContent()
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Jump a week' }).click()
  await expect(clock).not.toHaveText(before!)

  await page.getByRole('button', { name: '375', exact: true }).click()
  const frameWidth = await page.locator('.frame').evaluate((el) => el.getBoundingClientRect().width)
  expect(frameWidth).toBeLessThanOrEqual(375)

  await page.getByRole('button', { name: 'Reduced motion' }).click()
  await expect(page.locator('.app')).toHaveClass(/\brm\b/)
})

test('without ?dev there is no dev bar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'The taproom' })).toBeVisible()
  await expect(page.getByRole('toolbar', { name: 'Simulation controls' })).toHaveCount(0)
})
