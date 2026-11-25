import { describe, expect, it } from 'vitest'
import { loadScenario, runScenario, SCENARIO } from '../dev/scenarios'
import { createView, gallery, hallBoard, history, practiceSeat, regularView, shopCards, skinCards, streakView } from './panels'

const played = async (id: string) => {
  const x = await loadScenario(id)
  await runScenario(x, SCENARIO[id])
  return x
}

describe('My Regular', () => {
  it('S2 after the win: Regular rank, XP bar, history row', async () => {
    const { session } = await played('s2')
    const v = regularView(session.snap)
    expect(v.rank).toBe('Regular')
    expect(v.xpLabel).toBe('Progress to Sharp')
    expect(v.xpText).toBe('114 / 500')
    expect(v.xpPct).toBe(4)
    expect(history(session.snap)).toEqual([{ roundId: 0, label: 'Quick table · pick 22', outcome: 'Won', coins: '+1.985 GNOT', points: '+34 pts' }])
    expect(v.owner).toBe(false)
  })

  it('S4 history shows the forfeit, S5 the refund', async () => {
    expect(history((await played('s4')).session.snap)[0]).toMatchObject({ outcome: 'Forfeit', coins: '−1 GNOT', points: '+0 pts' })
    expect(history((await played('s5')).session.snap)[0]).toMatchObject({ outcome: 'Cancelled, refunded', coins: '±0 GNOT' })
  })

  it('S13 owner sees the withdraw panel', async () => {
    const { session } = await loadScenario('s13')
    expect(regularView(session.snap)).toMatchObject({ owner: true, fees: '0.105', withdrawDisabled: false })
  })

  it('S8 streak at risk, then reset after three missed weeks', async () => {
    const x = await loadScenario('s8')
    const v = streakView(x.session.snap)
    expect(v).toMatchObject({ title: '3-week streak', atRisk: true, weekLeft: '20 hours', broken: false })
    expect(v.riskLine).toBe("Your streak ends in 20 hours. Sit down for one round. If you don't, a freeze covers the week.")
    await runScenario(x, SCENARIO.s8)
    expect(streakView(x.session.snap)).toMatchObject({ streak: 0, broken: true, freezes: 0 })
  })
})

describe('Shop and New table', () => {
  it('cards cover 12 items per slot with buy reasons and equip states', async () => {
    const { session } = await loadScenario('s9')
    const hats = shopCards(session.snap, 'hat')
    expect(hats).toHaveLength(12)
    expect(hats.map((c) => c.word)).toEqual(['Common', 'Common', 'Common', 'Rare', 'Rare', 'Rare', 'Epic', 'Epic', 'Epic', 'Legendary', 'Legendary', 'Legendary'])
    expect(hats[0]).toMatchObject({ id: 'h1', button: 'Buy · 40 pts', action: 'buy', reason: '' })
    expect(hats[6]).toMatchObject({ id: 'h3', reason: 'Need 200 more points.' })
    expect(hats[0].look.hat).toBe('h1')

  })

  it('S9 end state: hat equipped, Moonlit owned, Gold-trim locked with the reason', async () => {
    const { session } = await played('s9')
    expect(shopCards(session.snap, 'hat')[0]).toMatchObject({ owned: true, equipped: true, button: 'Equipped · take off', action: 'unequip' })
    expect(skinCards(session.snap).map((k) => k.status)).toEqual(['Free · everyone owns it', 'Owned', '400 points'])
    const cv = createView(session.snap, 2)
    expect(cv.locked).toBe(true)
    expect(cv.lockReason).toBe('Locked: the Gold-trim table costs 400 points. You have 10.')
    expect(cv.showReason).toBe(false)
    expect(createView(session.snap, 1).locked).toBe(false)
  })
})

describe('The Hall', () => {
  it('boards sort by tab and include you', async () => {
    const x = await played('s2')
    x.session.openPanel('hall')
    await x.session.refresh()
    const s = x.session.snap
    const net = hallBoard(s, 'net')
    expect(net[0]).toMatchObject({ name: 'Fennel', value: '+14.2' })
    const me = net.find((r) => r.me)!
    expect(me.value).toBe('+1.985')
    const sharp = hallBoard(s, 'sharp')
    expect(sharp[0]).toMatchObject({ name: 'You', value: '1.3' })
    expect(hallBoard(s, 'points').find((r) => r.me)?.value).toBe('114')
    expect(gallery(s)[0]).toMatchObject({ name: 'Fennel', score: 40 })
  })
})

describe('practice', () => {
  it('regulars seal every 1.5 s and flip from 9 s', () => {
    expect(practiceSeat(2, 2000)).toMatchObject({ sealed: false, revealed: false })
    expect(practiceSeat(2, 3000)).toMatchObject({ sealed: true, revealed: false })
    expect(practiceSeat(2, 12_200)).toMatchObject({ revealed: true, justFlipped: true })
  })
})
