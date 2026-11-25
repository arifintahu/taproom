import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { commitHash, sha256Hex } from './commit'
import { applyMissedWeeks, bonusOf, computeResult, feeOf, pointsFor, rankOf, streakOnPlay, weekOf } from './rules'
import { avatarLayers } from './avatar'
import { dur, fmtG, humanLong } from './format'
import { ENTRY_FEE, ITEMS, SLOTS } from './constants'
import type { Player } from './types'

const player = (p: Partial<Player> = {}): Player => ({
  addr: 'a', lifetime: 0, spent: 0, streak: 0, lastWeek: null, freezes: 0, owned: [], equipped: {}, skins: [0], ...p,
})
const e = (addr: string, pick: number | null, revealed = pick !== null) => ({ addr, pick, revealed })

describe('commit hash', () => {
  it('matches node sha256 for the realm format "<pick>:<salt>"', () => {
    for (const t of ['', 'abc', '22:salt', 'x'.repeat(200), 'ünï']) {
      expect(sha256Hex(t)).toBe(createHash('sha256').update(t).digest('hex'))
    }
    expect(commitHash(22, 's')).toBe(createHash('sha256').update('22:s').digest('hex'))
  })
})

describe('settle maths', () => {
  it('3 players: average 35, target 23.33, closest wins, 0.5% fee', () => {
    const r = computeResult([e('a', 33), e('b', 50), e('me', 22)], 2, 3)
    expect(r.cancelled).toBe(false)
    expect(r.winners).toEqual(['me'])
    expect(r.fee).toBe(15_000)
    expect(r.credited.me).toBe(2_985_000)
  })

  it('tie splits the prize, remainder to the first winner in join order', () => {
    const r = computeResult([e('me', 20), e('moss', 20), e('c', 50), e('d', 60)], 2, 3)
    expect(r.winners).toEqual(['me', 'moss'])
    expect(r.credited).toEqual({ me: 1_990_000, moss: 1_990_000 })
    // 3 winners of a 3 GNOT pot: prize 2_985_000 does not split evenly
    const t = computeResult([e('x', 10), e('y', 10), e('z', 10)], 2, 3)
    expect(t.credited.x).toBe(995_000)
    expect(t.credited.x + t.credited.y + t.credited.z + t.fee).toBe(t.pot)
  })

  it('fewer than 2 reveals voids the round: full refund to everyone, no fee', () => {
    const r = computeResult([e('a', null), e('b', null), e('me', 40)], 2, 3)
    expect(r.cancelled).toBe(true)
    expect(r.fee).toBe(0)
    expect(r.credited).toEqual({ a: ENTRY_FEE, b: ENTRY_FEE, me: ENTRY_FEE })
  })

  it('two revealers: the lower pick always wins', () => {
    for (let a = 0; a <= 100; a += 7) for (let b = a + 1; b <= 100; b += 9) {
      expect(computeResult([e('hi', b), e('lo', a)], 2, 3).winners).toEqual(['lo'])
    }
  })

  it('invariant: credited + fee == pot for every completed round', () => {
    let seed = 1
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 500; i++) {
      const n = 2 + Math.floor(rnd() * 9)
      const entries = Array.from({ length: n }, (_, j) => e('p' + j, rnd() < 0.8 ? Math.floor(rnd() * 101) : null))
      const r = computeResult(entries, 2, 3)
      const paid = Object.values(r.credited).reduce((a, b) => a + b, 0)
      expect(paid + r.fee).toBe(r.pot)
      expect(r.fee).toBe(r.cancelled ? 0 : feeOf(r.pot))
    }
  })

  it('points: 10 per reveal, 30 for a win, plus bonus; nothing in a void round', () => {
    const r = computeResult([e('a', 33), e('b', 50), e('me', 22)], 2, 3)
    expect(pointsFor(r, 'me', true, 4)).toBe(34)
    expect(pointsFor(r, 'a', true, 0)).toBe(10)
    expect(pointsFor(r, 'x', false, 8)).toBe(0)
    const v = computeResult([e('a', 1), e('b', null)], 2, 3)
    expect(pointsFor(v, 'a', true, 4)).toBe(0)
  })
})

describe('streak', () => {
  it('week index aligns to Monday 00:00 UTC', () => {
    const mon = Date.UTC(2026, 10, 23) / 1000
    expect(weekOf(mon)).toBe(weekOf(mon - 1) + 1)
    expect(weekOf(mon + 7 * 86400 - 1)).toBe(weekOf(mon))
  })

  it('bonus sequence 4, 8, 12, 16, 20, 20', () => {
    expect([1, 2, 3, 4, 5, 6].map(bonusOf)).toEqual([4, 8, 12, 16, 20, 20])
  })

  it('update rule per spec section 8', () => {
    const p = player()
    streakOnPlay(p, 10)
    expect(p.streak).toBe(1)
    streakOnPlay(p, 10)
    expect(p.streak).toBe(1)
    streakOnPlay(p, 11)
    expect(p.streak).toBe(2)
    p.freezes = 2
    streakOnPlay(p, 14) // 2 missed, 2 freezes
    expect([p.streak, p.freezes]).toEqual([3, 0])
    p.freezes = 1
    streakOnPlay(p, 17) // 2 missed, 1 freeze: reset and freezes used up
    expect([p.streak, p.freezes]).toEqual([1, 0])
  })

  it('lazy missed-week evaluation then a play equals the play alone', () => {
    for (const [gap, fr] of [[1, 0], [2, 1], [3, 2], [3, 1], [5, 0]]) {
      const a = player({ streak: 3, lastWeek: 10, freezes: fr })
      const b = structuredClone(a)
      streakOnPlay(a, 10 + gap)
      applyMissedWeeks(b, 10 + gap)
      streakOnPlay(b, 10 + gap)
      expect(b).toEqual(a)
    }
  })

  it('ranks by lifetime points', () => {
    expect([0, 99, 100, 499, 500, 1500, 4000].map(rankOf)).toEqual([0, 0, 1, 1, 2, 3, 4])
  })
})

describe('catalogue and avatar', () => {
  it('48 items, 12 per slot, 3 per rarity', () => {
    expect(ITEMS).toHaveLength(48)
    for (const s of SLOTS) expect(ITEMS.filter((i) => i.slot === s)).toHaveLength(12)
  })

  it('layers in draw order with the cap when no hat', () => {
    expect(avatarLayers('x').layers.map((l) => l.sheet)).toEqual(['body', 'head', 'blink', 'cap'])
    const full = avatarLayers('x', { hat: 'h7', outfit: 'o1', held: 'i12', companion: 'c3' })
    expect(full.layers.map((l) => [l.sheet, l.frame])).toEqual([
      ['comp', 2], ['body', full.combo], ['outfit', 0], ['head', full.combo], ['blink', full.combo], ['hat', 6], ['held', 11],
    ])
  })
})

describe('format', () => {
  it('formats GNOT and durations', () => {
    expect(fmtG(2_985_000)).toBe('2.985')
    expect(dur(65)).toBe('1:05')
    expect(dur(7205)).toBe('2:00:05')
    expect(humanLong(20 * 3600)).toBe('20 hours')
  })
})

describe('shortHash', () => {
  it('keeps the first and last 6 characters, lowercased', async () => {
    const { shortHash } = await import('./format')
    expect(shortHash('2797446EF6C555B17C217BF0560B878A22B86C1537F947F67B56FE340E1EFBE9')).toBe('279744…1efbe9')
    expect(shortHash('ABC')).toBe('abc')
  })
})

describe('shortAddr', () => {
  it('shortens bech32 addresses for name tags and keeps the mock stand-ins', async () => {
    const { shortAddr } = await import('./format')
    expect(shortAddr('g1f5hdkzzfu4kd5hse9nyvxra0al8sy8rnzht4xs')).toBe('g1f5hd…t4xs')
    expect(shortAddr('g1br4...9ma1')).toBe('g1br4...9ma1')
  })
})
