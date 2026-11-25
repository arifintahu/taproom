// Realm JSON views (realm/taproom/views.gno) to the UI's types.

import { ITEM, SLOTS, type ItemCode, type Look, type Slot } from '../../game/constants'
import { computeResult } from '../../game/rules'
import type { Player, Round } from '../../game/types'

/** Realm item IDs: slotBase + n, hat 100, outfit 200, held 300, companion 400; n = 1..12. */
const PREFIX: Record<Slot, string> = { hat: 'h', outfit: 'o', held: 'i', companion: 'c' }
const BASE: Record<string, number> = { h: 100, o: 200, i: 300, c: 400 }

export function itemId(code: ItemCode): number {
  const n = Number(code.slice(1))
  const base = BASE[code[0]]
  if (!base || !ITEM[code] || !Number.isInteger(n)) throw new Error(`unknown item ${code}`)
  return base + n
}

export function itemCode(id: number): ItemCode | null {
  const slot = SLOTS[Math.floor(id / 100) - 1]
  const code = slot ? `${PREFIX[slot]}${id % 100}` : ''
  return ITEM[code] ? code : null
}

export const slotIndex = (slot: Slot) => SLOTS.indexOf(slot)

export interface RoundJSON {
  id: number
  creator: string
  skin: number
  start: number
  commitEnd: number
  revealEnd: number
  num: number
  den: number
  settled: boolean
  pot: number
  fee: number
  winners: string[]
  entries: { addr: string; revealed: boolean; pick: number | null; bonus: number }[]
}

export interface PlayerJSON {
  addr: string
  lifetime: number
  spent: number
  streak: number
  lastWeek: number | null
  freezes: number
  owned: number[]
  equipped: number[]
  skins: number[]
  claimable: number
}

export function toLook(equipped: number[]): Look {
  const look: Look = {}
  SLOTS.forEach((slot, i) => {
    const code = equipped[i] ? itemCode(equipped[i]) : null
    if (code) look[slot] = code
  })
  return look
}

export function toPlayer(j: PlayerJSON): Player {
  return {
    addr: j.addr, lifetime: j.lifetime, spent: j.spent, streak: j.streak, lastWeek: j.lastWeek, freezes: j.freezes,
    owned: j.owned.map(itemCode).filter((c): c is ItemCode => !!c), equipped: toLook(j.equipped), skins: j.skins,
  }
}

/**
 * The realm stores pot, fee and winners; the payout split is derived with the same rules as Settle
 * (see computeResult), so credited amounts never need their own storage. A mismatch means the client and
 * realm disagree, which is worth failing loudly on.
 */
export function toRound(j: RoundJSON, looks: Map<string, Look>): Round {
  let result: Round['result'] = null
  if (j.settled) {
    result = computeResult(j.entries, j.num, j.den)
    const same = result.winners.length === j.winners.length && result.winners.every((w, i) => w === j.winners[i])
    if (!same || result.fee !== j.fee || result.pot !== j.pot) throw new Error(`round ${j.id}: client settle maths disagrees with the realm`)
  }
  return {
    id: j.id, creator: j.creator, skin: j.skin, start: j.start, commitEnd: j.commitEnd, revealEnd: j.revealEnd,
    num: j.num, den: j.den, settled: j.settled, result,
    entries: j.entries.map((e) => ({ addr: e.addr, look: looks.get(e.addr) ?? {}, revealed: e.revealed, pick: e.pick, bonus: e.bonus })),
  }
}
