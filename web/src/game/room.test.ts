import { describe, expect, it } from 'vitest'
import { loadScenario } from '../dev/scenarios'
import { hearthState, hotspots, places, roomScale, tableSlots } from './room'

describe('room layout', () => {
  it('scale: 2 below 1024 px, capped at 2.6 above', () => {
    expect(roomScale(375, 375)).toBe(2)
    expect(roomScale(1280, 1248)).toBeCloseTo((1248 - 36) / 560)
    expect(roomScale(2560, 2500)).toBe(2.6)
  })

  it('S2: one live table with two regulars, two empty slots, 10 hotspots', async () => {
    const { session } = await loadScenario('s2')
    const s = session.snap
    const t = tableSlots(s, null)
    expect(t.map((x) => x.roundId)).toEqual([0, null, null])
    expect(t[0].gnomes).toHaveLength(2)
    expect(t[0].gnomes.map((g) => g.rect.x)).toEqual([205 - 24 - 9, 205 - 24 + 9])
    expect(t[0].label).toMatch(/^Quick · 2\/10 · seal 1:30$/)
    expect(t[0].coins).toBe('s')
    expect(t[0].hourglass).toBe('full')
    expect(t[1].label).toBe('Empty table')
    const spots = hotspots(s, null)
    expect(spots).toHaveLength(10)
    expect(spots.find((h) => h.id === 'table-0')?.tag).toBe('Quick table · 2 of 10 · sealing')
    expect(spots.find((h) => h.id === 'table-1')?.action).toEqual({ kind: 'create' })
    expect(places(s, null).map((p) => p.label)).toEqual(['Ledger', 'My Regular', 'Hall', 'Table 1', 'Hearth', 'Barkeep', 'Fees jar', 'Tailor'])
  })

  it('your seat shows in green after joining', async () => {
    const { session } = await loadScenario('s2')
    session.openRound(0)
    session.requestJoin()
    await session.approve()
    expect(tableSlots(session.snap, 0)[0].label.startsWith('Your seat · ')).toBe(true)
  })

  it('hearth: low when at risk, cold at streak 0, lit when not connected', async () => {
    expect(hearthState((await loadScenario('s8')).session.snap)).toBe('low')
    expect(hearthState((await loadScenario('s2')).session.snap)).toBe('cold')
    expect(hearthState((await loadScenario('s1')).session.snap)).toBe('lit')
    expect(hearthState((await loadScenario('s13')).session.snap)).toBe('lit')
  })
})
