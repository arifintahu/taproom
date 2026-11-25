import { describe, expect, it } from 'vitest'
import { Guide, loadAt, WAIT_MS } from './guide'
import { loadScenario, SCENARIO, SCENARIOS } from './scenarios'

describe('guided mode', () => {
  it('Next walks every scenario to its last step', async () => {
    for (const sc of SCENARIOS) {
      const g = await loadAt(sc.id, 'guided')
      for (let i = 0; i < 40 && !g.finished; i++) await g.next()
      expect(g.finished, `${sc.code} stuck at step ${g.step + 1}: ${g.current?.t}`).toBe(true)
    }
  })

  it('advances on its own when the player does the step', async () => {
    const x = await loadScenario('s2')
    const g = new Guide(x, SCENARIO.s2, 'guided')
    expect(g.target()).toBe('openTable')
    x.session.openRound(0)
    expect(g.check()).toBe(true)
    expect(g.step).toBe(1)
    expect(g.target()).toBe('lock')
  })

  it('a waiting step acts by itself after the pause', async () => {
    let now = 1000
    const g = await loadAt('s2', 'guided', 2)
    const w = new Guide(g.ctx, g.sc, 'guided', () => now)
    w.step = 2
    expect(w.current?.wait).toBe(true)
    expect(await w.tick()).toBe(false) // starts the pause
    now += WAIT_MS - 1
    expect(await w.tick()).toBe(false)
    now += 2
    expect(await w.tick()).toBe(true)
    expect(w.step).toBe(3) // in the reveal window now
  })

  it('free mode never moves or pulses on its own', async () => {
    const x = await loadScenario('s2')
    const g = new Guide(x, SCENARIO.s2, 'free')
    x.session.openRound(0)
    expect(g.check()).toBe(false)
    expect(g.target()).toBeUndefined()
  })

  it('Back rebuilds the scenario at an earlier step', async () => {
    const g = await loadAt('s2', 'guided', 3)
    expect(g.step).toBe(3)
    expect(g.current?.t).toBe('Reveal your pick')
    expect(g.ctx.session.currentRound()?.entries.some((e) => e.addr === g.ctx.mock.wallet.address)).toBe(true)
  })
})
