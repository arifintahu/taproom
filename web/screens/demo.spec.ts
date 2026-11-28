import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Records the demo video's footage (pnpm demo): one continuous take of the game on the mock chain,
// the realm's gnoweb pages on Onyx, and a terminal running the settle checker. Each test writes its
// video plus a JSON file of scene start times (seconds from the start of the video), so an editor
// can cut it to the narration. DEMO_OUT picks the output folder (default ./demo-out).
const OUT = process.env.DEMO_OUT ?? 'demo-out'
const REALM = process.env.DEMO_REALM ?? 'g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom/v2'
const ROUND = process.env.DEMO_ROUND ?? '0'
const CHECKER = process.env.DEMO_CHECKER_OUTPUT ?? ''

type Marks = { name: string; t: number }[]

/** A visible cursor: Playwright's video does not draw the mouse. */
const CURSOR = `
  (() => {
    const c = document.createElement('div')
    c.id = 'demo-cursor'
    c.style.cssText = 'position:fixed;z-index:99999;left:0;top:0;width:18px;height:18px;pointer-events:none;' +
      'border-radius:50%;background:rgba(255,214,120,.85);box-shadow:0 0 0 3px rgba(40,24,12,.7);transform:translate(-50%,-50%);transition:transform .08s'
    document.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    document.addEventListener('mousedown', () => { c.style.transform = 'translate(-50%,-50%) scale(.7)' }, true)
    document.addEventListener('mouseup', () => { c.style.transform = 'translate(-50%,-50%)' }, true)
    const add = () => document.body ? document.body.appendChild(c) : requestAnimationFrame(add)
    add()
  })()`

function recorder(page: Page, name: string) {
  const start = Date.now()
  const marks: Marks = []
  return {
    mark: (scene: string) => marks.push({ name: scene, t: (Date.now() - start) / 1000 }),
    async save() {
      marks.push({ name: 'end', t: (Date.now() - start) / 1000 })
      const video = page.video()
      await page.close()
      mkdirSync(OUT, { recursive: true })
      if (video) await video.saveAs(join(OUT, `${name}.webm`))
      writeFileSync(join(OUT, `${name}.json`), JSON.stringify(marks, null, 2))
    },
  }
}

/** Move the visible cursor to an element, pause, then click it. */
async function point(page: Page, loc: ReturnType<Page['locator']>, click = true, pause = 450) {
  await loc.scrollIntoViewIfNeeded()
  const box = await loc.boundingBox()
  if (!box) throw new Error('element has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
  await page.waitForTimeout(pause)
  if (click) await loc.click()
}

const dev = (page: Page, fn: string) => page.evaluate(`(async () => { const x = window.__taproom; ${fn} })()`)

async function approve(page: Page, hold = 2600) {
  const sheet = page.getByRole('dialog')
  await page.waitForTimeout(hold) // time to read the Confirm sheet
  await point(page, sheet.getByRole('button', { name: 'Approve and sign' }))
  await expect(sheet.getByText(/Confirmed in block \d+/)).toBeVisible()
  await page.waitForTimeout(900)
  await point(page, sheet.getByRole('button', { name: 'Done' }))
}

test('game', async ({ page }) => {
  test.setTimeout(240_000)
  const rec = recorder(page, 'game')
  await page.addInitScript(CURSOR)
  await page.goto('/?dev&scn=s2&mode=free')
  await page.getByRole('group', { name: 'The taproom' }).waitFor()
  await page.addStyleTag({ content: '.dev { display: none !important; } :root { --dev-h: 0px !important; }' })
  await page.evaluate(() => document.fonts.ready)

  // 1. title card over the room
  rec.mark('title')
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = 'demo-title'
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-content:center;text-align:center;background:rgba(16,10,6,.72);' +
      'font-family:"Pixelify Sans",monospace;color:#f3dca8;letter-spacing:.02em'
    d.innerHTML = '<div style="font-size:84px;font-weight:700;text-shadow:4px 4px 0 #2a160c">Taproom</div>' +
      '<div style="font-size:30px;margin-top:10px;color:#e9c98a">a tavern of mind games on Gno.land</div>'
    document.body.appendChild(d)
  })
  await page.waitForTimeout(5500)
  await page.evaluate(() => document.getElementById('demo-title')?.remove())

  // 2. the room: tables, hearth, notice board, tailor
  rec.mark('room')
  for (const name of [/^Quick table · 2 of 10/, /^Hearth · Weekly streak/, /^Notice board · The Hall/, /^Tailor's wardrobe · Shop/, /^Barkeep · How to play/]) {
    await point(page, page.getByRole('button', { name }).first(), false, 2200)
  }

  // 3. the table
  rec.mark('table')
  await point(page, page.getByRole('button', { name: /^Quick table · 2 of 10/ }).first())
  await expect(page.getByRole('heading', { name: /Quick table/ })).toBeVisible()
  await page.waitForTimeout(3500)
  await point(page, page.getByRole('region', { name: 'Money breakdown' }), false, 3500)

  // 4. seal 22, Confirm sheet
  rec.mark('seal')
  const num = page.getByRole('spinbutton', { name: 'Number' })
  await point(page, num)
  await num.fill('')
  await page.keyboard.type('22', { delay: 220 })
  await page.waitForTimeout(900)
  await point(page, page.getByRole('button', { name: 'Seal my pick · pay 1 GNOT' }))
  await approve(page, 6500)
  await expect(page.getByRole('heading', { name: 'Your slip is sealed: 22' })).toBeVisible()
  await page.waitForTimeout(2500)

  // 5. reveal, settle, chalk tally
  rec.mark('reveal')
  await dev(page, `x.mock.skipTo(0, 'reveal')`)
  await page.waitForTimeout(1500)
  await point(page, page.getByRole('button', { name: 'Reveal my pick' }))
  await approve(page, 1800)
  await page.waitForTimeout(2500)
  await dev(page, `x.mock.skipTo(0, 'settle')`)
  await page.waitForTimeout(1500)
  await point(page, page.getByRole('button', { name: 'Settle the round' }))
  await approve(page, 1800)
  await expect(page.getByRole('heading', { name: 'You won 2.985 GNOT' })).toBeVisible()
  await point(page, page.getByRole('region', { name: 'Chalk tally' }), false, 5000)

  // 6. claim, My Regular, hearth
  rec.mark('claim')
  await point(page, page.getByRole('button', { name: 'Claim 2.985 GNOT' }))
  await approve(page, 1500)
  await page.waitForTimeout(1500)
  await point(page, page.getByRole('button', { name: '← Taproom' }))
  await page.waitForTimeout(1200)
  await point(page, page.getByRole('button', { name: /Upstairs · My Regular/ }).first())
  await page.waitForTimeout(4500)
  await page.keyboard.press('Escape')
  await point(page, page.getByRole('button', { name: /Hearth · Weekly streak/ }).first())
  await page.waitForTimeout(4500)
  await page.keyboard.press('Escape')

  // 7. tailor and the Hall
  rec.mark('shop')
  await point(page, page.getByRole('button', { name: /Tailor's wardrobe · Shop/ }).first())
  await page.waitForTimeout(2500)
  const buy = page.getByRole('button', { name: /^Buy · 40 pts/ }).first()
  if (await buy.count()) {
    await point(page, buy)
    await approve(page, 1500)
    const equip = page.getByRole('button', { name: /^Equip/ }).first()
    if (await equip.count()) {
      await point(page, equip)
      await approve(page, 1200)
    }
  }
  await page.waitForTimeout(1500)
  await page.keyboard.press('Escape')
  await point(page, page.getByRole('button', { name: /Notice board · The Hall/ }).first())
  await page.waitForTimeout(5000)
  await page.keyboard.press('Escape')

  // 10. end card
  rec.mark('end-card')
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;place-content:center;text-align:center;background:rgba(16,10,6,.8);' +
      'font-family:"Pixelify Sans",monospace;color:#f3dca8'
    d.innerHTML = '<div style="font-size:64px;font-weight:700;text-shadow:4px 4px 0 #2a160c">Pull up a stool</div>' +
      '<div style="font-size:32px;margin-top:18px">taproom.arifintahu.com</div>' +
      '<div style="font-size:24px;margin-top:8px;color:#e9c98a">github.com/arifintahu/taproom</div>'
    document.body.appendChild(d)
  })
  await page.waitForTimeout(6000)
  await rec.save()
})

test('onchain', async ({ page }) => {
  test.setTimeout(120_000)
  const rec = recorder(page, 'onchain')
  await page.addInitScript(CURSOR)
  const base = `https://onyx.testnets.gno.land/r/${REALM}`
  rec.mark('realm-home')
  await page.goto(base)
  await page.waitForTimeout(4000)
  rec.mark('round-page')
  await page.goto(`${base}:round/${ROUND}`)
  await page.waitForTimeout(2500)
  await page.mouse.wheel(0, 260)
  await page.waitForTimeout(4500)
  rec.mark('sealedpoll')
  await page.goto(`https://onyx.testnets.gno.land/r/${REALM.replace(/taproom\/v\d+$/, 'sealedpoll/v0')}`)
  await page.waitForTimeout(4000)
  await rec.save()
})

test('checker', async ({ page }) => {
  test.setTimeout(60_000)
  const rec = recorder(page, 'checker')
  const cmd = `$ node tools/verify/verify-round.mjs --all --rpc https://rpc.onyx.testnets.gno.land:443 --realm gno.land/r/${REALM}`
  await page.setContent(`<html><body style="margin:0;background:#120c08;color:#e9dcc3;font:20px/1.45 Consolas,monospace;padding:42px">
    <pre id="t" style="white-space:pre-wrap;margin:0"></pre></body></html>`)
  rec.mark('terminal')
  await page.evaluate(async ([c, out]) => {
    const t = document.getElementById('t')!
    for (const ch of c) { t.textContent += ch; await new Promise((r) => setTimeout(r, 18)) }
    t.textContent += '\n'
    for (const line of out.split('\n')) {
      await new Promise((r) => setTimeout(r, 260))
      const span = document.createElement('span')
      span.textContent = line + '\n'
      if (/OK: matches|all \d+ rounds match/.test(line)) span.style.color = '#8fd18a'
      t.appendChild(span)
    }
  }, [cmd, CHECKER] as const)
  await page.waitForTimeout(5000)
  await rec.save()
})
