import { describe, expect, it } from 'vitest'
import { ITEMS } from '../../game/constants'
import { hallFromBoards, itemCode, itemId, toLook, toPlayer, toRound, type LeaderRowJSON, type PlayerJSON, type RoundJSON } from './mapping'
import { gnoStr, qAddress, qInt, qJSON, qString } from './qeval'
import { reason } from './signers'

// Raw `data:` lines from gnokey query vm/qeval on a local gnodev chain (gno v1.8.0, 2026-11-25).
const RAW = {
  count: '(0 int)',
  fees: '(0 int64)',
  owner: '("g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq" .uverse.address)',
  rounds:
    '("[{\\"id\\":0,\\"creator\\":\\"g1f5hdkzzfu4kd5hse9nyvxra0al8sy8rnzht4xs\\",\\"skin\\":0,\\"start\\":1795579261,\\"commitEnd\\":1795579381,\\"revealEnd\\":1795579501,\\"num\\":2,\\"den\\":3,\\"settled\\":false,\\"pot\\":1000000,\\"fee\\":0,\\"winners\\":[],\\"entries\\":[{\\"addr\\":\\"g1f5hdkzzfu4kd5hse9nyvxra0al8sy8rnzht4xs\\",\\"revealed\\":false,\\"pick\\":null,\\"bonus\\":0}]}]" string)',
  player:
    '("{\\"addr\\":\\"g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq\\",\\"lifetime\\":0,\\"spent\\":0,\\"streak\\":0,\\"lastWeek\\":null,\\"freezes\\":0,\\"owned\\":[],\\"equipped\\":[0,0,0,0],\\"skins\\":[0],\\"claimable\\":0}" string)',
}

describe('qeval parsing', () => {
  it('reads ints, addresses and JSON strings', () => {
    expect(qInt(RAW.count)).toBe(0)
    expect(qInt(RAW.fees)).toBe(0)
    expect(qInt('(2985000 int64)')).toBe(2_985_000)
    expect(qInt('(-4 int)')).toBe(-4)
    expect(qAddress(RAW.owner)).toBe('g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq')
    expect(qString('("[]" string)')).toBe('[]')
    const rounds = qJSON<RoundJSON[]>(RAW.rounds)
    expect(rounds[0]).toMatchObject({ id: 0, commitEnd: 1795579381, pot: 1_000_000 })
    expect(rounds[0].entries[0].pick).toBeNull()
    expect(qJSON<PlayerJSON>(RAW.player).equipped).toEqual([0, 0, 0, 0])
  })

  it('refuses output it does not recognise', () => {
    expect(() => qInt('(1 string)')).toThrow()
    expect(() => qString('(0 int)')).toThrow()
    expect(() => qInt('(99999999999999999999 int64)')).toThrow()
  })

  it('quotes expression arguments as Gno string literals', () => {
    expect(gnoStr('g1abc')).toBe('"g1abc"')
  })
})

describe('mapping', () => {
  it('item codes round-trip to realm item IDs for all 48 items', () => {
    expect(itemId('h7')).toBe(107)
    expect(itemId('c12')).toBe(412)
    for (const it of ITEMS) expect(itemCode(itemId(it.id))).toBe(it.id)
    expect(itemCode(113)).toBeNull()
    expect(itemCode(0)).toBeNull()
    expect(() => itemId('x1')).toThrow()
  })

  it('equipped slots become a look; owned IDs become codes', () => {
    expect(toLook([107, 0, 312, 401])).toEqual({ hat: 'h7', held: 'i12', companion: 'c1' })
    const p = toPlayer({ ...qJSON<PlayerJSON>(RAW.player), owned: [101, 205], equipped: [101, 0, 0, 0] })
    expect(p.owned).toEqual(['h1', 'o5'])
    expect(p.equipped).toEqual({ hat: 'h1' })
  })

  it('a settled round gets its payout split from the shared settle maths', () => {
    const base = qJSON<RoundJSON[]>(RAW.rounds)[0]
    const j: RoundJSON = {
      ...base, settled: true, pot: 3_000_000, fee: 15_000, winners: ['me'],
      entries: [{ addr: 'a', revealed: true, pick: 33, bonus: 4 }, { addr: 'b', revealed: true, pick: 50, bonus: 4 }, { addr: 'me', revealed: true, pick: 22, bonus: 4 }],
    }
    const r = toRound(j, new Map())
    expect(r.result?.credited).toEqual({ me: 2_985_000 })
    expect(() => toRound({ ...j, winners: ['a'] }, new Map())).toThrow(/disagrees/)
  })
})

describe('hall from LeaderboardJSON', () => {
  const row = (addr: string, o: Partial<LeaderRowJSON> = {}): LeaderRowJSON => ({
    rank: 1, addr, points: 0, net: 0, wins: 0, sharp100: null, bestStreak: 0, style: 0, equipped: [0, 0, 0, 0], ...o,
  })

  it('maps a row: sharp in hundredths, best streak, look from item IDs', () => {
    const [e] = hallFromBoards([[row('a', { points: 34, net: 2_980_000, sharp100: 222, bestStreak: 3, equipped: [107, 0, 0, 401] })]])
    expect(e).toEqual({ addr: 'a', look: { hat: 'h7', companion: 'c1' }, net: 2_980_000, sharp: 2.22, streak: 3, points: 34 })
    expect(hallFromBoards([[row('b')]])[0].sharp).toBeNull()
  })

  it('merges the boards by address, so a regular on several boards appears once', () => {
    const hall = hallFromBoards([[row('a'), row('b')], [row('b'), row('c')], []])
    expect(hall.map((e) => e.addr)).toEqual(['a', 'b', 'c'])
  })
})

describe('signer errors', () => {
  it('keeps the realm panic message', () => {
    expect(reason(new Error('deliver transaction failed: ... panic: commit window closed\nstack...'))).toBe('commit window closed')
    expect(reason('plain failure')).toBe('plain failure')
  })
})
