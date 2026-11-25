import {
  BPS_TOTAL, ENTRY_FEE, FEE_BPS, ITEM, MAX_FREEZES, POINTS_PLAY, POINTS_WIN, RANKS, RARITY,
  STREAK_CAP, STREAK_STEP, WEEK_OFFSET, WEEK_SECONDS, type Look,
} from './constants'
import type { Phase, Player, Round, RoundResult, Ugnot } from './types'

export const weekOf = (ts: number) => Math.floor((ts - WEEK_OFFSET) / WEEK_SECONDS)
export const weekEnd = (ts: number) => (weekOf(ts) + 1) * WEEK_SECONDS + WEEK_OFFSET

export function phaseOf(r: Round, now: number): Phase {
  if (r.settled) return 'done'
  if (now < r.commitEnd) return 'commit'
  if (now < r.revealEnd) return 'reveal'
  return 'settle'
}

export function pickOk(raw: string): boolean {
  if (raw.trim() === '') return false
  const v = Number(raw)
  return Number.isInteger(v) && v >= 0 && v <= 100
}

export function rankOf(lifetime: number): number {
  let i = 0
  RANKS.forEach(([min], j) => {
    if (lifetime >= min) i = j
  })
  return i
}

export const bonusOf = (streak: number) => Math.min(STREAK_STEP * streak, STREAK_CAP)
export const feeOf = (pot: Ugnot) => Math.floor((pot * FEE_BPS) / BPS_TOTAL)
export const spendable = (p: Player) => p.lifetime - p.spent

export function styleScore(look: Look): number {
  return Object.values(look).reduce((a, id) => a + (id && ITEM[id] ? RARITY[ITEM[id].rarity].style : 0), 0)
}

/** Pot, fee and winner's net if `players` sit at the table. */
export function breakdown(players: number) {
  const pot = players * ENTRY_FEE
  const fee = feeOf(pot)
  return { pot, fee, net: pot - fee }
}

interface Revealable {
  addr: string
  revealed: boolean
  pick: number | null
}

/**
 * Settle maths (spec section 5): winners minimise |den*n*pick - num*sum|; ties split the prize,
 * the remainder goes to the first winner in join order; fewer than 2 reveals voids the round.
 */
export function computeResult(entries: Revealable[], num: number, den: number): RoundResult {
  const pot = entries.length * ENTRY_FEE
  const rev = entries.filter((e) => e.revealed && e.pick !== null)
  const credited: Record<string, Ugnot> = {}
  if (rev.length < 2) {
    entries.forEach((e) => (credited[e.addr] = ENTRY_FEE))
    return { pot, fee: 0, cancelled: true, revealers: rev.length, sum: 0, winners: [], credited }
  }
  const n = rev.length
  const sum = rev.reduce((a, e) => a + (e.pick as number), 0)
  const dist = (p: number) => Math.abs(den * n * p - num * sum)
  const best = Math.min(...rev.map((e) => dist(e.pick as number)))
  const winners = rev.filter((e) => dist(e.pick as number) === best).map((e) => e.addr)
  const fee = feeOf(pot)
  const prize = pot - fee
  const share = Math.floor(prize / winners.length)
  const rem = prize - share * winners.length
  winners.forEach((a, i) => (credited[a] = share + (i === 0 ? rem : 0)))
  return { pot, fee, cancelled: false, revealers: n, sum, winners, credited }
}

export const avgOf = (res: RoundResult) => (res.revealers ? res.sum / res.revealers : 0)
export const targetOf = (res: RoundResult, num = 2, den = 3) =>
  res.revealers ? (num * res.sum) / (den * res.revealers) : 0

/** Points a revealer earns at settle: only in completed rounds. */
export function pointsFor(res: RoundResult, addr: string, revealed: boolean, bonus: number): number {
  if (res.cancelled || !revealed) return 0
  return POINTS_PLAY + bonus + (res.winners.includes(addr) ? POINTS_WIN - POINTS_PLAY : 0)
}

/** Streak update on a qualifying play (spec section 8; realm updateStreak). Mutates p. */
export function streakOnPlay(p: Player, week: number): void {
  if (p.lastWeek === null || p.streak === 0) {
    p.streak = 1
  } else {
    const g = week - p.lastWeek
    if (g === 1) p.streak++
    else if (g >= 2) {
      const missed = g - 1
      if (p.freezes >= missed) {
        p.freezes -= missed
        p.streak++
      } else {
        p.streak = 1
        p.freezes = 0
      }
    }
  }
  p.lastWeek = week
}

export type MissedWeeks = { kind: 'none' } | { kind: 'frozen'; used: number } | { kind: 'reset'; missed: number; used: number }

/**
 * Applies weeks already missed before `week` (lazy evaluation). Freezes cover missed weeks;
 * with too few the streak shows 0 and all freezes are used up. Mutates p.
 * Combined with streakOnPlay it gives the same result as streakOnPlay alone.
 */
export function applyMissedWeeks(p: Player, week: number): MissedWeeks {
  if (p.lastWeek === null || p.streak === 0) return { kind: 'none' }
  const missed = week - p.lastWeek - 1
  if (missed <= 0) return { kind: 'none' }
  if (missed <= p.freezes) {
    p.freezes -= missed
    p.lastWeek = week - 1
    return { kind: 'frozen', used: missed }
  }
  const used = p.freezes
  p.freezes = 0
  p.streak = 0
  p.lastWeek = week - 1
  return { kind: 'reset', missed, used }
}

/** Streak played this week, at risk (not yet played this week), or broken (reset to 0). */
export function streakState(p: Player, now: number) {
  const played = p.lastWeek === weekOf(now)
  return {
    played,
    atRisk: p.streak > 0 && !played,
    broken: p.streak === 0 && p.lastWeek !== null,
    weekLeft: weekEnd(now) - now,
  }
}

export const freezesOk = (n: number) => n >= 0 && n <= MAX_FREEZES
