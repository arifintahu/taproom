// Derived values for the windows (handover section 8): My Regular, Hearth, Shop, Hall, New table.
// Ported from the prototype's reg/shop/hall/cr values in renderVals().

import {
  ENTRY_FEE, ITEM, ITEMS, LINES, PRESETS, RANKS, RARITY, SKINS, SLOTS, type ItemCode, type Look, type Rarity, type Slot,
} from './constants'
import { fmtG, humanLong, shortAddr } from './format'
import { bonusOf, pointsFor, rankOf, spendable, streakState, styleScore } from './rules'
import { buyBlock, connected, createBlock, freezeBlock, isOwner, presetOfRound, realmBlock, type Snapshot } from './selectors'
import type { HallEntry } from './types'

export const RARITY_COLOR: Record<Rarity, string> = {
  common: 'var(--mu)', rare: 'var(--teal)', epic: 'var(--violet)', legendary: 'var(--amber)',
}

export const SLOT_LABEL: Record<Slot, string> = { hat: 'Hat', outfit: 'Outfit', held: 'Held item', companion: 'Companion' }

// ---------- streak (My Regular and the Hearth) ----------

export function streakView(s: Snapshot) {
  const p = s.player
  const st = p ? streakState(p, s.now) : { atRisk: false, broken: false, weekLeft: 0, played: false }
  const weekLeft = humanLong(st.weekLeft)
  const streak = p?.streak ?? 0
  const freezes = p?.freezes ?? 0
  return {
    streak,
    freezes,
    title: streak > 0 ? `${streak}-week streak` : 'No streak yet',
    line: streak > 0 ? LINES.streak(streak, bonusOf(streak)) : 'Reveal in a paid round this week to light the flame.',
    weekLeft,
    atRisk: st.atRisk,
    riskLine: LINES.risk(weekLeft) + (freezes > 0 ? " If you don't, a freeze covers the week." : ''),
    broken: st.broken,
    freezeReason: freezeBlock(s),
  }
}

// ---------- My Regular ----------

export interface HistoryRow { roundId: number; label: string; outcome: string; coins: string; points: string }

/** Settled rounds you sat in, newest first. */
export function history(s: Snapshot, limit = 6): HistoryRow[] {
  if (!connected(s)) return []
  const me = s.wallet.address
  return s.rounds
    .filter((r) => r.settled && r.result && r.entries.some((e) => e.addr === me))
    .reverse()
    .slice(0, limit)
    .map((r) => {
      const res = r.result!
      const e = r.entries.find((x) => x.addr === me)!
      const win = res.winners.includes(me)
      const outcome = res.cancelled ? 'Cancelled, refunded' : win ? (res.winners.length > 1 ? 'Split win' : 'Won') : e.revealed ? 'Lost' : 'Forfeit'
      const delta = (res.credited[me] ?? 0) - ENTRY_FEE
      const coins = res.cancelled ? '±0' : delta > 0 ? `+${fmtG(delta)}` : `−${fmtG(-delta)}`
      return {
        roundId: r.id,
        label: `${PRESETS[presetOfRound(r)].label} table · pick ${e.pick ?? 'sealed'}`,
        outcome,
        coins: `${coins} GNOT`,
        points: `+${pointsFor(res, me, e.revealed, e.bonus)} pts`,
      }
    })
}

export function regularView(s: Snapshot) {
  const p = s.player
  const life = p?.lifetime ?? 0
  const ri = rankOf(life)
  const next = RANKS[ri + 1]
  const rb = realmBlock(s)
  return {
    rank: RANKS[ri][1],
    xpLabel: next ? `Progress to ${next[1]}` : 'Top rank reached',
    xpPct: next ? Math.round(((life - RANKS[ri][0]) / (next[0] - RANKS[ri][0])) * 100) : 100,
    xpText: next ? `${life} / ${next[0]}` : String(life),
    lifetime: life,
    spent: p?.spent ?? 0,
    spendable: p ? spendable(p) : 0,
    slots: SLOTS.map((slot) => ({ slot, label: SLOT_LABEL[slot], item: p?.equipped[slot] ? ITEM[p.equipped[slot]!].name : 'Empty' })),
    owned: ITEMS.filter((i) => p?.owned.includes(i.id)).map((i) => ({
      id: i.id, name: i.name, rarity: i.rarity, word: RARITY[i.rarity].word, equipped: p?.equipped[i.slot] === i.id, disabled: !!rb,
    })),
    history: history(s),
    owner: isOwner(s),
    fees: fmtG(s.fees),
    withdrawDisabled: !s.fees || !!rb,
  }
}

// ---------- Shop ----------

export interface ShopCard {
  id: ItemCode
  name: string
  rarity: Rarity
  word: string
  look: Look
  price: string
  owned: boolean
  equipped: boolean
  button: string
  action: 'buy' | 'equip' | 'unequip'
  reason: string
}

/** Item cards for one slot tab, Common to Legendary, previewed on your own gnome. */
export function shopCards(s: Snapshot, slot: Slot): ShopCard[] {
  const p = s.player
  const rb = realmBlock(s)
  return ITEMS.filter((i) => i.slot === slot).map((i) => {
    const owned = !!p?.owned.includes(i.id)
    const equipped = p?.equipped[i.slot] === i.id
    const base = { id: i.id, name: i.name, rarity: i.rarity, word: RARITY[i.rarity].word, look: { ...(p?.equipped ?? {}), [i.slot]: i.id }, owned, equipped }
    if (!owned) return { ...base, price: `${i.price} points`, button: `Buy · ${i.price} pts`, action: 'buy' as const, reason: buyBlock(s, i.price) }
    return { ...base, price: 'Owned', button: equipped ? 'Equipped · take off' : 'Equip', action: equipped ? ('unequip' as const) : ('equip' as const), reason: rb }
  })
}

export function skinCards(s: Snapshot) {
  const p = s.player
  return SKINS.map((k) => {
    const owned = (p?.skins ?? [0]).includes(k.id)
    const reason = owned ? '' : buyBlock(s, k.price)
    return {
      id: k.id, key: k.key, name: k.name, owned,
      status: owned ? (k.id === 0 ? 'Free · everyone owns it' : 'Owned') : `${k.price} points`,
      button: owned ? 'Owned' : `Buy · ${k.price} pts`,
      reason,
    }
  })
}

// ---------- New table sheet ----------

export function createView(s: Snapshot, skin: number) {
  const p = s.player
  const owned = (p?.skins ?? [0]).includes(skin)
  const reason = createBlock(s, skin)
  return {
    skins: SKINS.map((k) => {
      const own = (p?.skins ?? [0]).includes(k.id)
      return { id: k.id, key: k.key, name: k.name, locked: !own, tag: own ? (k.id === 0 ? 'Free' : 'Owned') : `${k.price} pts` }
    }),
    locked: !owned,
    lockReason: owned ? '' : `Locked: the ${SKINS[skin].name} costs ${SKINS[skin].price} points. You have ${p ? spendable(p) : 0}.`,
    reason,
    /** The lock box already explains a locked skin; show other reasons under the button. */
    showReason: !!reason && owned,
  }
}

// ---------- The Hall ----------

export type HallTab = 'net' | 'sharp' | 'streak' | 'points'
export const HALL_TABS: Record<HallTab, { title: string; col: string }> = {
  net: { title: 'Net coins', col: 'Net GNOT' },
  sharp: { title: 'Sharpest guesses', col: 'Avg distance' },
  streak: { title: 'Longest streak', col: 'Weeks' },
  points: { title: 'Points', col: 'Lifetime' },
}

/** Every regular on the board, with you added (from your player record) if you have not played yet. */
export function hallEntries(s: Snapshot): HallEntry[] {
  const rows = s.hall.slice()
  if (connected(s) && s.player && !rows.some((r) => r.addr === s.wallet.address)) {
    rows.push({ addr: s.wallet.address, look: s.player.equipped, net: 0, sharp: null, streak: s.player.streak, points: s.player.lifetime })
  }
  return rows
}

export function hallBoard(s: Snapshot, tab: HallTab) {
  const me = connected(s) ? s.wallet.address : ''
  const sorters: Record<HallTab, (a: HallEntry, b: HallEntry) => number> = {
    net: (a, b) => b.net - a.net,
    sharp: (a, b) => (a.sharp ?? Infinity) - (b.sharp ?? Infinity),
    streak: (a, b) => b.streak - a.streak,
    points: (a, b) => b.points - a.points,
  }
  const value: Record<HallTab, (x: HallEntry) => string> = {
    net: (x) => (x.net > 0 ? '+' : x.net < 0 ? '−' : '') + fmtG(Math.abs(x.net)),
    sharp: (x) => (x.sharp === null ? '—' : x.sharp.toFixed(1)),
    streak: (x) => String(x.streak),
    points: (x) => String(x.points),
  }
  return hallEntries(s).sort(sorters[tab]).map((x, i) => ({
    rank: i + 1, addr: x.addr, look: x.look, me: x.addr === me, name: x.addr === me ? 'You' : x.name ?? shortAddr(x.addr), value: value[tab](x),
  }))
}

export function gallery(s: Snapshot) {
  const me = connected(s) ? s.wallet.address : ''
  return hallEntries(s)
    .map((x) => ({ addr: x.addr, look: x.look, name: x.addr === me ? 'You' : x.name ?? shortAddr(x.addr), score: styleScore(x.look) }))
    .sort((a, b) => b.score - a.score)
}

// ---------- practice ----------

/** Practice seats: regulars seal every 1.5 s, then flip every 1.5 s from 9 s. */
export function practiceSeat(i: number, elapsedMs: number) {
  const sealedAt = i === 0 ? 0 : 1500 * i
  const revealAt = 9000 + 1500 * i
  return { revealed: elapsedMs >= revealAt, sealed: elapsedMs >= sealedAt, justFlipped: elapsedMs >= revealAt && elapsedMs - revealAt < 1000 }
}

export function practiceStatus(phase: 'sealed' | 'reveal', elapsedMs: number) {
  const left = Math.max(0, Math.ceil((18000 - elapsedMs) / 1000))
  return phase === 'sealed' ? `Regulars are sealing: ${Math.min(5, Math.floor(elapsedMs / 1500))} of 5 · ${left} s` : `Cards are flipping · ${left} s`
}

