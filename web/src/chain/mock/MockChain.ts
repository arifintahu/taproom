// In-memory chain that mirrors the realm (realm/taproom) plus scripted regulars.
// Drives the dev scenarios, the demo and the unit tests. Times are seconds of simulated block time.

import {
  ENTRY_FEE, FREEZE_COST, ITEM, MAX_FREEZES, MAX_OPEN_ROUNDS, MAX_PLAYERS, NETWORK, SKINS,
  TARGET_DEN, TARGET_NUM, PRESETS, REALM_PATH, type ItemCode, type PresetId, type Slot,
} from '../../game/constants'
import { commitHash } from '../../game/commit'
import { applyMissedWeeks, bonusOf, computeResult, pointsFor, streakOnPlay, targetOf, weekOf } from '../../game/rules'
import type { HallEntry, Player, Round, Ugnot, WalletInfo } from '../../game/types'
import type { ChainClient, TxResult } from '../types'
import { BOTS, ME_ADDR, OWNER_ADDR, T0 } from './bots'

interface MockEntry {
  addr: string
  name?: string
  commit: string
  revealed: boolean
  pick: number | null
  bonus: number
}

/** A regular who acts on a schedule: joins `joinAt` s after the start, reveals `revealAt` s into the reveal window. */
interface Script {
  addr: string
  name: string
  pick: number
  salt: string
  joinAt: number
  revealAt: number
  willReveal: boolean
}

interface MockRound {
  id: number
  creator: string
  skin: number
  start: number
  commitEnd: number
  revealEnd: number
  entries: MockEntry[]
  scripts: Script[]
  settled: boolean
  settledAt: number
  result: Round['result']
  judge: boolean
  next: number | null
}

export type SeedEntry =
  | { bot: number; pick: number; joined?: boolean; joinAt?: number; revealAt?: number; willReveal?: boolean; revealed?: boolean }
  | { me: true; pick: number; salt: string; revealed?: boolean }

export interface SeedRound {
  preset?: PresetId
  skin?: number
  start?: number
  creator?: string
  judge?: boolean
  entries?: SeedEntry[]
}

const HALL_SEED: [number, number, number, number, number][] = [
  [6, 14.2, 1.8, 11, 3980], [3, 9.6, 2.4, 8, 2210], [2, 6.1, 3.1, 6, 1460], [0, 3.3, 3.9, 5, 980],
  [1, 1.0, 4.6, 4, 720], [4, -0.4, 5.2, 3, 515], [5, -1.9, 6.0, 2, 330], [7, -2.7, 7.4, 1, 160],
]

const emptyPlayer = (addr: string): Player => ({
  addr, lifetime: 0, spent: 0, streak: 0, lastWeek: null, freezes: 0, owned: [], equipped: {}, skins: [0],
})

export class MockChain implements ChainClient {
  readonly realmPath = REALM_PATH
  readonly network = NETWORK
  readonly networkLabel = `Testnet ${NETWORK}`
  readonly walletName = 'Adena'
  clock = T0
  rounds: MockRound[] = []
  players = new Map<string, Player>()
  claimable = new Map<string, Ugnot>()
  fees: Ugnot = 0
  owner = OWNER_ADDR
  wallet = { installed: true, connected: false, address: ME_ADDR, network: NETWORK, balance: 5 * ENTRY_FEE }
  rpcUp = true
  /** Next write fails on chain with this reason (S10e). */
  failNext: string | null = null
  /** New tables fill with three scripted regulars. */
  fillNewRounds = true
  private txSeq = 0

  constructor() {
    BOTS.forEach((b) => {
      const p = emptyPlayer(b.addr)
      p.equipped = { ...b.look }
      this.players.set(b.addr, p)
    })
  }

  // ---------- dev controls (mock only) ----------

  advance(secs: number) {
    this.clock += secs
    this.runScripts()
  }

  jumpWeeks(k: number) {
    this.advance(k * 604_800)
  }

  /** Move the clock to the end of the commit or reveal window of a round. */
  skipTo(roundId: number, to: 'reveal' | 'settle') {
    const r = this.rounds[roundId]
    if (!r) return
    const target = to === 'reveal' ? r.commitEnd : r.revealEnd
    if (this.clock < target) this.advance(target - this.clock)
  }

  player(addr: string): Player {
    let p = this.players.get(addr)
    if (!p) {
      p = emptyPlayer(addr)
      this.players.set(addr, p)
    }
    return p
  }

  seedPlayer(addr: string, patch: Partial<Player>) {
    Object.assign(this.player(addr), patch)
  }

  addRound(o: SeedRound = {}): number {
    const p = PRESETS[o.preset ?? 'quick']
    const start = o.start ?? this.clock
    const r: MockRound = {
      id: this.rounds.length,
      creator: o.creator ?? BOTS[0].addr,
      skin: o.skin ?? 0,
      start,
      commitEnd: start + p.commitSecs,
      revealEnd: start + p.commitSecs + p.revealSecs,
      entries: [],
      scripts: [],
      settled: false,
      settledAt: 0,
      result: null,
      judge: !!o.judge,
      next: null,
    }
    this.rounds.push(r)
    ;(o.entries ?? []).forEach((e, i) => {
      if ('me' in e) {
        r.entries.push({ addr: this.wallet.address, commit: commitHash(e.pick, e.salt), revealed: false, pick: null, bonus: 0 })
        if (e.revealed) this.doReveal(r, this.wallet.address, e.pick, e.salt, r.commitEnd)
        return
      }
      const b = BOTS[e.bot]
      const s: Script = {
        addr: b.addr, name: b.name, pick: e.pick, salt: `bot-${r.id}-${i}`,
        joinAt: e.joinAt ?? 0, revealAt: e.revealAt ?? 20, willReveal: e.willReveal !== false,
      }
      if (e.joined) {
        r.entries.push({ addr: s.addr, name: s.name, commit: commitHash(s.pick, s.salt), revealed: false, pick: null, bonus: 0 })
        if (e.revealed) this.doReveal(r, s.addr, s.pick, s.salt, r.commitEnd)
      }
      r.scripts.push(s)
    })
    this.runScripts()
    return r.id
  }

  // ---------- reads ----------

  private up() {
    if (!this.rpcUp) throw new Error("Can't reach rpc.onyx.testnets.gno.land.")
  }

  private view(r: MockRound): Round {
    return {
      id: r.id, creator: r.creator, skin: r.skin, start: r.start, commitEnd: r.commitEnd, revealEnd: r.revealEnd,
      num: TARGET_NUM, den: TARGET_DEN, settled: r.settled, result: r.result ? structuredClone(r.result) : null,
      nextId: r.next ?? undefined,
      entries: r.entries.map((e) => ({
        addr: e.addr, name: e.name, look: { ...this.player(e.addr).equipped },
        revealed: e.revealed, pick: e.revealed ? e.pick : null, bonus: e.bonus,
      })),
    }
  }

  async getRounds() { this.up(); return this.rounds.map((r) => this.view(r)) }
  async getRound(id: number) {
    this.up()
    const r = this.rounds[id]
    if (!r) throw new Error('unknown round')
    return this.view(r)
  }
  /** Player as the realm would report it after applying missed weeks lazily. */
  async getPlayer(addr: string) {
    this.up()
    const p = structuredClone(this.player(addr))
    applyMissedWeeks(p, weekOf(this.clock))
    return p
  }
  async getClaimable(addr: string) { this.up(); return this.claimable.get(addr) ?? 0 }
  async getFeesAccrued() { this.up(); return this.fees }
  async feeRecipient() { this.up(); return this.owner }
  async now() { this.up(); return this.clock }

  /** Seeded standings for the regulars, [bot, net GNOT, avg distance, streak, points], plus every settled mock round. */
  async getHall(): Promise<HallEntry[]> {
    this.up()
    const base = new Map<string, { net: number; dist: number; n: number }>()
    HALL_SEED.forEach(([b, net, sharp]) => base.set(BOTS[b].addr, { net: net * ENTRY_FEE, dist: sharp * 10, n: 10 }))
    for (const r of this.rounds) {
      if (!r.result) continue
      const res = r.result
      const target = targetOf(res, TARGET_NUM, TARGET_DEN)
      for (const e of r.entries) {
        const st = base.get(e.addr) ?? { net: 0, dist: 0, n: 0 }
        st.net += (res.credited[e.addr] ?? 0) - ENTRY_FEE
        if (!res.cancelled && e.revealed && e.pick !== null) { st.dist += Math.abs(e.pick - target); st.n++ }
        base.set(e.addr, st)
      }
    }
    const seeded = new Map(HALL_SEED.map(([b, , , streak, points]) => [BOTS[b].addr, { streak, points }]))
    return [...base.entries()].map(([addr, st]) => {
      const p = this.player(addr)
      const seed = seeded.get(addr)
      return {
        addr, name: BOTS.find((b) => b.addr === addr)?.name, look: { ...p.equipped }, net: st.net,
        sharp: st.n ? st.dist / st.n : null, streak: Math.max(p.streak, seed?.streak ?? 0), points: p.lifetime + (seed?.points ?? 0),
      }
    })
  }

  async getWallet(): Promise<WalletInfo> { return { ...this.wallet } }
  async connect(): Promise<WalletInfo> {
    if (this.wallet.installed) this.wallet.connected = true
    return { ...this.wallet }
  }
  async reconnect() { this.rpcUp = true }

  // ---------- writes ----------

  private tx(fn: (caller: string) => void): TxResult {
    if (!this.rpcUp) return { ok: false, reason: "Can't reach the network." }
    if (!this.wallet.installed || !this.wallet.connected) return { ok: false, reason: 'Wallet not connected.' }
    if (this.wallet.network !== NETWORK) return { ok: false, reason: `Adena is on ${this.wallet.network}, not ${NETWORK}.` }
    if (this.failNext) {
      const reason = this.failNext
      this.failNext = null
      return { ok: false, reason }
    }
    try {
      fn(this.wallet.address)
    } catch (e) {
      return { ok: false, reason: (e as Error).message }
    }
    const n = ++this.txSeq
    return { ok: true, hash: commitHash(n, 'tx').slice(0, 16).toUpperCase(), height: 482_113 + n * 7 }
  }

  private round(id: number): MockRound {
    const r = this.rounds[id]
    if (!r) throw new Error('unknown round')
    return r
  }

  async newRound(commitSecs: number, revealSecs: number, boardSkin: number) {
    return this.tx((caller) => {
      if (commitSecs < 60 || revealSecs < 60 || commitSecs > 86_400 || revealSecs > 86_400) throw new Error('windows must be 1 minute to 24 hours')
      if (!SKINS[boardSkin]) throw new Error('unknown board skin')
      if (!this.player(caller).skins.includes(boardSkin)) throw new Error('creator does not own this board skin')
      const open = this.rounds.filter((r) => r.creator === caller && !r.settled).length
      if (open >= MAX_OPEN_ROUNDS) throw new Error('open round limit reached')
      const preset = commitSecs >= 43_200 ? 'daily' : commitSecs >= 1800 ? 'standard' : 'quick'
      const entries: SeedEntry[] = this.fillNewRounds
        ? [{ bot: 5, pick: 31, joinAt: 8, revealAt: 15 }, { bot: 8, pick: 47, joinAt: 25, revealAt: 35 }, { bot: 3, pick: 22, joinAt: 50, revealAt: 50 }]
        : []
      this.addRound({ preset, skin: boardSkin, creator: caller, entries })
    })
  }

  async join(roundId: number, commit: string) {
    return this.tx((caller) => {
      const r = this.round(roundId)
      if (this.clock >= r.commitEnd) throw new Error('commit window closed')
      if (!/^[0-9a-f]{64}$/.test(commit)) throw new Error('commit must be 64 hex chars')
      if (r.entries.some((e) => e.addr === caller)) throw new Error('already joined')
      if (r.entries.length >= MAX_PLAYERS) throw new Error('round is full')
      if (this.wallet.balance < ENTRY_FEE) throw new Error('insufficient funds')
      this.wallet.balance -= ENTRY_FEE
      r.entries.push({ addr: caller, commit, revealed: false, pick: null, bonus: 0 })
    })
  }

  async reveal(roundId: number, pick: number, salt: string) {
    return this.tx((caller) => {
      const r = this.round(roundId)
      if (this.clock < r.commitEnd || this.clock >= r.revealEnd) throw new Error('not in reveal window')
      this.doReveal(r, caller, pick, salt, this.clock)
    })
  }

  async settle(roundId: number) {
    return this.tx((caller) => this.doSettle(this.round(roundId), caller))
  }

  async claim() {
    return this.tx((caller) => {
      const amt = this.claimable.get(caller) ?? 0
      if (amt <= 0) throw new Error('nothing to claim')
      this.claimable.set(caller, 0) // effects before the send
      this.wallet.balance += amt
    })
  }

  async buyItem(itemId: ItemCode) {
    return this.tx((caller) => {
      const it = ITEM[itemId]
      if (!it) throw new Error('unknown item')
      const p = this.player(caller)
      if (p.owned.includes(itemId)) throw new Error('already owned')
      this.spend(p, it.price)
      p.owned.push(itemId)
    })
  }

  async equip(slot: Slot, itemId: ItemCode | null) {
    return this.tx((caller) => {
      const p = this.player(caller)
      if (itemId === null) {
        delete p.equipped[slot]
        return
      }
      const it = ITEM[itemId]
      if (!it || it.slot !== slot) throw new Error('item does not fit this slot')
      if (!p.owned.includes(itemId)) throw new Error('item not owned')
      p.equipped[slot] = itemId
    })
  }

  async buyFreeze() {
    return this.tx((caller) => {
      const p = this.player(caller)
      // Apply weeks already missed first, so a freeze bought now cannot cover a past week
      // and a stale freeze count cannot block the purchase (the realm does the same).
      applyMissedWeeks(p, weekOf(this.clock))
      if (p.freezes >= MAX_FREEZES) throw new Error('freeze limit reached')
      this.spend(p, FREEZE_COST)
      p.freezes++
    })
  }

  async buySkin(skin: number) {
    return this.tx((caller) => {
      const k = SKINS[skin]
      if (!k) throw new Error('unknown board skin')
      const p = this.player(caller)
      if (p.skins.includes(skin)) throw new Error('already owned')
      this.spend(p, k.price)
      p.skins.push(skin)
    })
  }

  async withdrawFees() {
    return this.tx((caller) => {
      if (caller !== this.owner) throw new Error('only the fee recipient can withdraw')
      if (this.fees <= 0) throw new Error('no fees accrued')
      const amt = this.fees
      this.fees = 0
      this.wallet.balance += amt
    })
  }

  // ---------- internals ----------

  private spend(p: Player, price: number) {
    if (p.lifetime - p.spent < price) throw new Error('not enough points')
    p.spent += price
  }

  private doReveal(r: MockRound, addr: string, pick: number, salt: string, ts: number) {
    const e = r.entries.find((x) => x.addr === addr)
    if (!e) throw new Error('not a player in this round')
    if (e.revealed) throw new Error('already revealed')
    if (!Number.isInteger(pick) || pick < 0 || pick > 100) throw new Error('pick must be 0..100')
    if (commitHash(pick, salt) !== e.commit) throw new Error('reveal does not match commit')
    e.revealed = true
    e.pick = pick
    const p = this.player(addr)
    streakOnPlay(p, weekOf(ts))
    e.bonus = bonusOf(p.streak)
  }

  private doSettle(r: MockRound, by: string) {
    if (this.clock < r.revealEnd) throw new Error('reveal window still open')
    if (r.settled) throw new Error('already settled')
    r.settled = true
    r.settledAt = this.clock
    const res = computeResult(r.entries, TARGET_NUM, TARGET_DEN)
    res.settledBy = by
    Object.entries(res.credited).forEach(([a, amt]) => this.claimable.set(a, (this.claimable.get(a) ?? 0) + amt))
    this.fees += res.fee
    r.entries.forEach((e) => {
      const pts = pointsFor(res, e.addr, e.revealed, e.bonus)
      if (pts) this.player(e.addr).lifetime += pts
    })
    r.result = res
  }

  /** Scripted regulars join and reveal on schedule; judge tables settle and respawn themselves. */
  private runScripts() {
    for (const r of this.rounds.slice()) {
      if (r.settled) {
        if (r.judge && r.next === null && this.clock >= r.settledAt + 20) r.next = this.spawnJudge()
        continue
      }
      const cw = r.commitEnd - r.start
      const rw = r.revealEnd - r.commitEnd
      for (const s of r.scripts) {
        let e = r.entries.find((x) => x.addr === s.addr)
        if (!e && s.joinAt < cw && this.clock >= r.start + s.joinAt && r.entries.length < MAX_PLAYERS) {
          e = { addr: s.addr, name: s.name, commit: commitHash(s.pick, s.salt), revealed: false, pick: null, bonus: 0 }
          r.entries.push(e)
        }
        if (e && !e.revealed && s.willReveal && s.revealAt < rw && this.clock >= r.commitEnd + s.revealAt) {
          this.doReveal(r, s.addr, s.pick, s.salt, r.commitEnd + s.revealAt)
        }
      }
      if (r.judge && this.clock >= r.revealEnd + 3) this.doSettle(r, BOTS[2].addr)
    }
  }

  private judgeSeq = 0
  spawnJudge(start?: number): number {
    const P = [[41, 29, 55, 18], [36, 47, 22, 60], [33, 25, 50, 44]][this.judgeSeq++ % 3]
    return this.addRound({
      judge: true,
      start,
      entries: [
        { bot: 2, pick: P[0], joinAt: 0, revealAt: 10 },
        { bot: 3, pick: P[1], joinAt: 15, revealAt: 30 },
        { bot: 6, pick: P[2], joinAt: 35, revealAt: 50 },
        { bot: 8, pick: P[3], joinAt: 70, revealAt: 80 },
      ],
    })
  }
}
