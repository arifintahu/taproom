import { describe, expect, it } from 'vitest'
import { ENTRY_FEE } from '../game/constants'
import { rankOf } from '../game/rules'
import { loadScenario, runScenario, SCENARIOS, type Ctx } from './scenarios'

const run = async (id: string) => {
  const x = await loadScenario(id)
  const failed = await runScenario(x, SCENARIOS.find((s) => s.id === id)!)
  return { x, failed }
}
const me = (x: Ctx) => x.mock.wallet.address
const round = (x: Ctx) => x.session.currentRound()!

describe('every scenario reaches its last step', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.code} ${sc.name}`, async () => {
      const { failed } = await run(sc.id)
      expect(failed, `stuck at step ${failed + 1}: ${sc.steps[failed]?.t}`).toBe(-1)
    })
  }
})

describe('scenario outcomes', () => {
  it('S2 pays 2.985 GNOT, +34 points, ranks up to Regular', async () => {
    const { x } = await run('s2')
    const r = x.mock.rounds[0]
    expect(r.result?.winners).toEqual([me(x)])
    expect(r.result?.credited[me(x)]).toBe(2_985_000)
    // 5 GNOT - 1 entry + 2.985 claimed
    expect(x.mock.wallet.balance).toBe(6_985_000)
    expect(x.session.snap.player?.lifetime).toBe(80 + 34)
    expect(rankOf(x.session.snap.player!.lifetime)).toBe(1)
    expect(x.session.snap.player?.streak).toBe(1)
    expect(x.session.ui.panel).toBe('regular')
  })

  it('S3 loses but still earns 10 + streak bonus', async () => {
    const { x } = await run('s3')
    const r = x.mock.rounds[0]
    expect(r.result?.winners).toEqual(['g1th2...k8s0'])
    expect(x.session.snap.player?.lifetime).toBe(150 + 10 + 12) // streak 2 -> 3, bonus 12
  })

  it('S4 forfeits the deposit with no points', async () => {
    const { x } = await run('s4')
    const r = round(x)
    expect(r.result?.cancelled).toBe(false)
    expect(r.result?.credited[me(x)]).toBeUndefined()
    expect(x.session.snap.player?.lifetime).toBe(0)
    expect(x.session.snap.claimable).toBe(0)
  })

  it('S5 cancels and refunds everyone with no fee', async () => {
    const { x } = await run('s5')
    const r = round(x)
    expect(r.result?.cancelled).toBe(true)
    expect(r.result?.fee).toBe(0)
    expect(Object.values(r.result!.credited)).toEqual([ENTRY_FEE, ENTRY_FEE, ENTRY_FEE])
    expect(x.mock.fees).toBe(0)
    expect(x.mock.wallet.balance).toBe(5 * ENTRY_FEE)
    expect(x.session.snap.player?.lifetime).toBe(0)
  })

  it('S6 splits 1.99 GNOT each', async () => {
    const { x } = await run('s6')
    const r = round(x)
    expect(r.result?.winners).toHaveLength(2)
    expect(Object.values(r.result!.credited)).toEqual([1_990_000, 1_990_000])
    expect(x.mock.wallet.balance).toBe(4 * ENTRY_FEE + 1_990_000)
  })

  it('S7 two players: the lower pick wins', async () => {
    const { x } = await run('s7')
    expect(round(x).result?.winners).toEqual([me(x)])
  })

  it('S8 freezes cover two weeks, then the streak resets with freezes used up', async () => {
    const { x } = await run('s8')
    expect(x.session.snap.player?.streak).toBe(0)
    expect(x.session.snap.player?.freezes).toBe(0)
    // 340 - 220 = 120 spendable, two freezes bought
    expect(x.session.snap.player!.lifetime - x.session.snap.player!.spent).toBe(40)
  })

  it('S9 opens a Moonlit table after buying hat and skin', async () => {
    const { x } = await run('s9')
    const p = x.session.snap.player!
    expect(p.equipped.hat).toBe('h1')
    expect(p.skins).toContain(1)
    expect(p.lifetime - p.spent).toBe(200 - 40 - 150)
    expect(round(x).skin).toBe(1)
    expect(x.session.ui.view).toBe('table')
  })

  it('S10d rejecting sends nothing', async () => {
    const { x } = await run('s10d')
    expect(x.mock.rounds[0].entries.some((e) => e.addr === me(x))).toBe(false)
    expect(x.mock.wallet.balance).toBe(5 * ENTRY_FEE)
  })

  it('S10e shows the chain reason, then the retry joins', async () => {
    const { x } = await run('s10e')
    expect(x.session.ui.tx?.stage).toBe('confirmed')
    expect(x.mock.wallet.balance).toBe(4 * ENTRY_FEE)
  })

  it('S11 judge table settles itself, then you join and play the next one', async () => {
    const { x } = await run('s11')
    expect(x.mock.rounds[0].result?.settledBy).toBe('g1p9x...3dq7')
    const r = round(x)
    expect(r.id).toBeGreaterThan(0)
    expect(r.settled).toBe(true)
    expect(r.entries.some((e) => e.addr === me(x) && e.revealed)).toBe(true)
  })

  it('S12 confirm sheet shows pot, fee and winner net before signing', async () => {
    const x = await loadScenario('s12')
    x.session.openRound(0)
    expect(x.session.requestJoin()).toBe(true)
    const rows = Object.fromEntries(x.session.ui.tx!.rows)
    expect(rows['Pot after you join']).toBe('3 GNOT')
    expect(rows['Tavern fee (0.5%, completed rounds)']).toBe('0.015 GNOT')
    expect(rows['Winner receives']).toBe('2.985 GNOT')
    expect(x.mock.rounds[0].entries).toHaveLength(2) // nothing sent before Approve
  })

  it('S13 owner withdraws 0.105 GNOT', async () => {
    const { x } = await run('s13')
    expect(x.mock.fees).toBe(0)
    expect(x.mock.wallet.balance).toBe(8 * ENTRY_FEE + 105_000)
  })

  it('withdraw is refused for anyone but the fee recipient', async () => {
    const x = await loadScenario('s2')
    x.mock.fees = 5000
    await x.session.refresh()
    expect(x.session.requestWithdraw()).toBe(false)
    expect((await x.mock.withdrawFees()).ok).toBe(false)
  })
})
