import { describe, expect, it } from 'vitest'
import { loadScenario, runScenario, SCENARIO } from '../dev/scenarios'
import { chalk, closeupScale, potX, roundView, seats, slateText } from './closeup'

const played = async (id: string) => {
  const x = await loadScenario(id)
  await runScenario(x, SCENARIO[id])
  return x
}

describe('close-up', () => {
  it('scale: 1.6 minimum on narrow screens, 3.4 maximum on wide ones', () => {
    expect(closeupScale(375, 375)).toBe(1.6)
    expect(closeupScale(800, 800)).toBeCloseTo(780 / 320)
    expect(closeupScale(1600, 1600)).toBe(3.4)
  })

  it('S2 before joining: visitor picker, breakdown for 3 players, sealed seats', async () => {
    const { session } = await loadScenario('s2')
    session.openRound(0)
    const s = session.snap
    const r = session.currentRound()!
    const v = roundView(s, r)
    expect(v.state).toBe('visitor-pick')
    expect(v.join).toEqual({ players: 3, pot: '3', fee: '0.015', net: '2.985' })
    expect(v.feeTable.map((f) => f.net)).toEqual(['1.99', '4.975', '9.95'])
    expect(v.bestWithThree).toBe(true)
    expect(seats(s, r).map((x) => x.status)).toEqual(['sealed', 'sealed'])
    expect(slateText(s, r)[0]).toBe('SEAL YOUR NUMBER')
    expect(potX(s, r)).toBe(146)
  })

  it('two-seat warning: shown while a table could end with two picks, not from the third seat on', async () => {
    const { session } = await loadScenario('s2')
    session.openRound(0)
    const s = session.snap
    const r = session.currentRound()!
    expect(roundView(s, r).twoWarn).toBeNull() // 2 seated, you would be the third
    const one = roundView(s, { ...r, entries: r.entries.slice(0, 1) })
    expect(one.state).toBe('visitor-pick')
    expect(one.twoWarn).toMatch(/^You would make two seats\. .*lower pick always wins/)
    expect(roundView(s, { ...r, entries: [] }).twoWarn).toMatch(/^No one is seated yet\./)
    const me = { ...r.entries[1], addr: s.wallet.address }
    const sealed = roundView({ ...s, wallet: { ...s.wallet, connected: true } }, { ...r, entries: [r.entries[0], me] })
    expect(sealed.state).toBe('sealed')
    expect(sealed.twoWarn).toMatch(/^Two seats so far\./)
    expect(roundView(s, { ...r, commitEnd: s.now - 1 }).twoWarn).toBeNull() // commit window over
  })

  it('S2 after settle and claim: win, +34 points, pot slides to your seat', async () => {
    const { session } = await played('s2')
    const s = session.snap
    const r = s.rounds[0]
    const v = roundView(s, r)
    expect(v.outcome).toBe('win')
    expect(v.myPay).toBe('2.985')
    expect(v.points).toBe(34)
    expect(v.pointsBreak).toBe('10 for revealing + 20 for the win + 4 streak bonus')
    expect(v.claimed).toBe(true)
    expect(v.steps.every((x) => x.done)).toBe(true)
    expect(slateText(s, r)).toEqual(['TARGET', '23.33', 'average 35'])
    const me = seats(s, r).find((x) => x.name === 'You')!
    expect(me.status).toBe('winner')
    expect(potX(s, r)).toBe(me.x + 12)
    expect(v.result?.chalk?.rows.find((x) => x.name === 'You')?.result).toBe('Winner')
  })

  it('S4 forfeit, S5 cancelled, S6 tie, S7 two-player reason', async () => {
    const s4 = (await played('s4')).session
    expect(roundView(s4.snap, s4.currentRound()!).outcome).toBe('forfeit')
    expect(seats(s4.snap, s4.currentRound()!).find((x) => x.name === 'You')?.status).toBe('forfeit')

    const s5 = (await played('s5')).session
    const v5 = roundView(s5.snap, s5.currentRound()!)
    expect(v5.outcome).toBe('refund')
    expect(v5.result?.cancelHead).toBe('Cancelled: 1 of 3 revealed')
    expect(slateText(s5.snap, s5.currentRound()!)[0]).toBe('CANCELLED')

    const s6 = (await played('s6')).session
    expect(roundView(s6.snap, s6.currentRound()!).result?.tie).toEqual({ share: '1.99', remainder: '0 ugnot' })

    const s7 = (await played('s7')).session
    expect(roundView(s7.snap, s7.currentRound()!).result?.twoWhy).toContain('picks 30 and 60, sum 90, target 30, so 30 wins')
  })

  it('chalk marks within 10 of each other stack on rows', () => {
    const c = chalk(
      [{ addr: 'a', name: 'A', pick: 20, revealed: true }, { addr: 'b', name: 'B', pick: 25, revealed: true }, { addr: 'c', name: 'C', pick: 40, revealed: true }, { addr: 'd', name: 'D', pick: null, revealed: false }],
      ['a'], 28.33, 18.89,
    )
    expect(c.marks.map((m) => [m.pick, m.row])).toEqual([[20, 0], [25, 1], [40, 0]])
    expect(c.rows.map((r) => r.result)).toEqual(['Winner', '—', '—', 'Forfeit'])
    expect(c.summary).toContain('Winner: A with 20, 1.11 away.')
  })
})
