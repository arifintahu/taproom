import { test, type Page } from '@playwright/test'

// README screenshots from the mock scenarios (?dev seeds them and exposes window.__taproom).
const OUT = '../media'

async function open(page: Page, scn: string, width = 1280, height = 820) {
  await page.setViewportSize({ width, height })
  await page.goto(`/?dev&scn=${scn}&mode=free`)
  await page.getByRole('group', { name: 'The taproom' }).waitFor()
  // toasts come and go; keep them out of the pictures
  await page.addStyleTag({ content: '.toasts, .dev { display: none !important; } :root { --dev-h: 0px !important; }' })
  await page.evaluate(() => document.fonts.ready)
}

const dev = (page: Page, fn: string) =>
  page.evaluate(`(async () => { const x = window.__taproom; ${fn} })()`)

const settle = (page: Page) => page.waitForTimeout(700)

test('room', async ({ page }) => {
  await open(page, 's2')
  await settle(page)
  await page.locator('.frame').screenshot({ path: `${OUT}/room.png` })
})

test('table, sealed', async ({ page }) => {
  await open(page, 's2')
  await dev(page, `x.session.openRound(0); x.session.setPickRaw('22'); x.session.requestJoin(); await x.session.approve(); x.session.closeTx()`)
  await settle(page)
  await page.locator('.frame').screenshot({ path: `${OUT}/table.png` })
})

test('confirm sheet', async ({ page }) => {
  await open(page, 's12')
  await dev(page, `x.session.openRound(0); x.session.requestJoin()`)
  await settle(page)
  await page.getByRole('dialog').screenshot({ path: `${OUT}/confirm.png` })
})

test('result', async ({ page }) => {
  await open(page, 's2', 1280, 1400)
  await dev(page, `
    const s = x.session
    s.openRound(0); s.setPickRaw('22'); s.requestJoin(); await s.approve(); s.closeTx()
    x.mock.skipTo(0, 'reveal'); await s.refresh(); s.requestReveal(); await s.approve(); s.closeTx()
    x.mock.skipTo(0, 'settle'); await s.refresh(); s.requestSettle(); await s.approve(); s.closeTx()`)
  await settle(page)
  await page.locator('.frame').screenshot({ path: `${OUT}/result.png` })
})

test('shop', async ({ page }) => {
  await open(page, 's9', 1280, 1500)
  await dev(page, `x.session.openPanel('shop')`)
  await settle(page)
  await page.getByRole('dialog').screenshot({ path: `${OUT}/shop.png` })
})

test('my regular', async ({ page }) => {
  await open(page, 's13', 1280, 1200)
  await dev(page, `x.session.openPanel('regular')`)
  await settle(page)
  await page.getByRole('dialog').screenshot({ path: `${OUT}/regular.png` })
})

test('mobile', async ({ page }) => {
  await open(page, 's2', 375, 812)
  await settle(page)
  await page.screenshot({ path: `${OUT}/mobile.png` })
})
