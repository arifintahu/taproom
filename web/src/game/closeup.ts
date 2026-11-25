// Table close-up (logical 320 x 150) and the round panels beside it, handover 6.3.
// Ported from the prototype's `rd` and `cu` values in renderVals().

import { ENTRY_FEE, MAX_PLAYERS, PRESETS, SKINS } from './constants'
import { dur, fmtG, fmtN, shortAddr } from './format'
import { avgOf, breakdown, phaseOf, pointsFor, targetOf } from './rules'
import { connected, presetOfRound, type Snapshot } from './selectors'
import type { Phase, Round } from './types'

export const CU_W = 320
export const CU_H = 150

/** k2 = min(3.4, (w - 36) / 320) at 1024 px and wider, else max(1.6, (w - 20) / 320). */
export const closeupScale = (viewport: number, container: number) =>
  viewport >= 1024 ? Math.min(3.4, (container - 36) / CU_W) : Math.max(1.6, (container - 20) / CU_W)

export type SeatStatus = 'sealed' | 'revealed' | 'winner' | 'forfeit' | 'no reveal' | 'refunded'

export interface Seat {
  addr: string
  name: string
  x: number
  open: boolean
  pick: number | null
  status: SeatStatus
  color: string
  winner: boolean
}

const STATUS_COLOR: Record<SeatStatus, string> = {
  sealed: 'var(--mu)', revealed: 'var(--ok)', winner: 'var(--amber)', forfeit: 'var(--red)', 'no reveal': 'var(--red)', refunded: 'var(--mu)',
}

export function displayName(s: Snapshot, addr: string, name?: string) {
  return connected(s) && addr === s.wallet.address ? 'You' : name ?? shortAddr(addr)
}

/** Seated gnomes: step = min(32, 270 / n), x_i = 160 + (i - (n-1)/2) * step - 24. */
export function seats(s: Snapshot, r: Round): Seat[] {
  const ph = phaseOf(r, s.now)
  const n = r.entries.length
  const step = Math.min(32, 270 / Math.max(n, 1))
  const win = r.result?.winners ?? []
  return r.entries.map((e, i) => {
    const isW = ph === 'done' && win.includes(e.addr)
    let status: SeatStatus
    if (ph === 'commit' || (!e.revealed && ph === 'reveal')) status = 'sealed'
    else if (e.revealed) status = isW ? 'winner' : 'revealed'
    else if (ph === 'done' && r.result?.cancelled) status = 'refunded'
    else status = ph === 'done' ? 'forfeit' : 'no reveal'
    return {
      addr: e.addr, name: displayName(s, e.addr, e.name), x: 160 + (i - (n - 1) / 2) * step - 24,
      open: e.revealed && ph !== 'commit', pick: e.pick, status, color: STATUS_COLOR[status], winner: isW,
    }
  })
}

/** Pot sits at 146, then slides to the first winner's slip after Settle. */
export function potX(s: Snapshot, r: Round): number {
  const seat = seats(s, r).find((x) => x.winner)
  return seat ? seat.x + 12 : 146
}

export function slateText(s: Snapshot, r: Round): [string, string, string] {
  const ph = phaseOf(r, s.now)
  if (ph === 'commit') return ['SEAL YOUR NUMBER', dur(r.commitEnd - s.now), 'target: 2/3 of the average']
  if (ph === 'reveal') return ['BREAK THE SEALS', dur(r.revealEnd - s.now), 'target: 2/3 of the average']
  if (ph === 'settle') return ['SAND HAS RUN OUT', 'settle', 'anyone can settle']
  const res = r.result
  if (!res || res.cancelled) return ['CANCELLED', 'refunds', 'no fee taken']
  return ['TARGET', fmtN(targetOf(res, r.num, r.den)), 'average ' + fmtN(avgOf(res))]
}

// ---------- chalk slate result ----------

export interface ChalkMark { addr: string; name: string; pick: number; left: number; row: number; win: boolean }
export interface ChalkRow { name: string; pick: string; dist: string; result: 'Winner' | 'Refunded' | 'Forfeit' | '—' }
export interface Chalk {
  marks: ChalkMark[]
  rows: ChalkRow[]
  avg: number
  target: number
  maxRow: number
  summary: string
}

/** Number line 0-100: picks within 10 of each other stack on rows so their circles never overlap. */
export function chalk(list: { addr: string; name: string; pick: number | null; revealed: boolean }[], winners: string[], avg: number, target: number, cancelled = false): Chalk {
  const used: { pick: number; row: number }[] = []
  const marks = list
    .filter((e) => e.revealed && e.pick !== null)
    .sort((a, b) => (a.pick as number) - (b.pick as number))
    .map((e) => {
      const pick = e.pick as number
      let row = 0
      while (used.some((m) => m.row === row && Math.abs(m.pick - pick) < 10)) row++
      used.push({ pick, row })
      return { addr: e.addr, name: e.name, pick, left: pick, row, win: winners.includes(e.addr) }
    })
  const rows: ChalkRow[] = list.map((e) => ({
    name: e.name,
    pick: e.revealed && e.pick !== null ? String(e.pick) : 'Not revealed',
    dist: e.revealed && e.pick !== null && !cancelled ? fmtN(Math.abs(e.pick - target)) : '—',
    result: winners.includes(e.addr) ? 'Winner' : cancelled ? 'Refunded' : e.revealed ? '—' : 'Forfeit',
  }))
  const wn = list.filter((e) => winners.includes(e.addr))
  const summary = `Number line from 0 to 100. Average ${fmtN(avg)}. Target ${fmtN(target)}, two thirds of the average. ` +
    (wn.length ? `Winner${wn.length > 1 ? 's' : ''}: ${wn.map((e) => `${e.name} with ${e.pick}, ${fmtN(Math.abs((e.pick as number) - target))} away`).join(' and ')}.` : '')
  return { marks, rows, avg, target, maxRow: used.reduce((a, m) => Math.max(a, m.row), 0), summary }
}

// ---------- the round panels ----------

export type MyState =
  | 'visitor-pick' // commit window, not seated: number picker + Seal
  | 'sealed' // commit window, seated
  | 'reveal-now' // reveal window, seated, not revealed
  | 'revealed-wait'
  | 'visitor-wait'
  | 'settle-now'
  | 'done'

export type Outcome = 'win' | 'lose' | 'forfeit' | 'refund' | 'visitor'

export interface RoundView {
  phase: Phase
  title: string
  seatsText: string
  bestWithThree: boolean
  steps: { label: string; done: boolean; current: boolean }[]
  countdownLabel: string
  countdown: string
  showCountdown: boolean
  live: string
  pot: string
  skinNote: string | null
  spectator: string | null
  state: MyState
  outcome: Outcome | null
  winnerName: string
  myPay: string
  claimable: boolean
  claimLabel: string
  claimed: boolean
  points: number
  pointsBreak: string
  join: { players: number; pot: string; fee: string; net: string }
  feeTable: { n: number; pot: string; fee: string; net: string }[]
  result: null | {
    chalk: Chalk | null
    pot: string
    fee: string
    prize: string
    tie: null | { share: string; remainder: string }
    twoWhy: string | null
    cancelHead: string | null
  }
}

const bucket = (secs: number) => (secs > 60 ? `about ${Math.ceil(secs / 60)} minutes left` : secs > 30 ? 'under a minute left' : 'under 30 seconds left')

export function roundView(s: Snapshot, r: Round): RoundView {
  const ph = phaseOf(r, s.now)
  const me = connected(s) ? r.entries.find((e) => e.addr === s.wallet.address) ?? null : null
  const res = r.result
  const win = res?.winners ?? []
  const myCredit = res && me ? res.credited[me.addr] ?? 0 : 0
  const iWin = !!(res && !res.cancelled && me && win.includes(me.addr))
  const oRefund = !!(res?.cancelled && me)
  const owed = (iWin || oRefund) && s.claimable > 0
  const idx = { commit: 0, reveal: 1, settle: 2, done: 3 }[ph]
  const steps = ['Commit', 'Reveal', 'Settle', 'Claim'].map((label, i) => ({
    label, current: i === idx, done: i < idx || (ph === 'done' && i === 3 && !owed),
  }))
  const left = ph === 'commit' ? r.commitEnd - s.now : ph === 'reveal' ? r.revealEnd - s.now : 0

  let state: MyState
  if (ph === 'commit') state = me ? 'sealed' : 'visitor-pick'
  else if (ph === 'reveal') state = me ? (me.revealed ? 'revealed-wait' : 'reveal-now') : 'visitor-wait'
  else if (ph === 'settle') state = 'settle-now'
  else state = 'done'

  let outcome: Outcome | null = null
  if (ph === 'done') {
    if (!me) outcome = 'visitor'
    else if (res?.cancelled) outcome = 'refund'
    else if (iWin) outcome = 'win'
    else outcome = me.revealed ? 'lose' : 'forfeit'
  }

  const points = res && me ? pointsFor(res, me.addr, me.revealed, me.bonus) : 0
  const pointsBreak = points ? `10 for revealing${iWin ? ' + 20 for the win' : ''}${me?.bonus ? ` + ${me.bonus} streak bonus` : ''}` : ''
  const w0 = r.entries.find((e) => e.addr === win[0])
  const j = breakdown(Math.min(MAX_PLAYERS, r.entries.length + 1))

  let result: RoundView['result'] = null
  if (res) {
    const prize = res.pot - res.fee
    const share = win.length ? Math.floor(prize / win.length) : 0
    const revealed = r.entries.filter((e) => e.revealed)
    let twoWhy: string | null = null
    if (!res.cancelled && revealed.length === 2) {
      const [a, b] = revealed.map((e) => e.pick as number).sort((x, y) => x - y)
      twoWhy = `With two players the target is 2/3 of the average, which is one third of the sum. A third of the sum always sits closer to the smaller number. Here: picks ${a} and ${b}, sum ${a + b}, target ${fmtN((a + b) / 3)}, so ${a} wins. Tables play best with 3 or more.`
    }
    result = {
      chalk: res.cancelled ? null : chalk(
        r.entries.map((e) => ({ addr: e.addr, name: displayName(s, e.addr, e.name), pick: e.pick, revealed: e.revealed })),
        win, avgOf(res), targetOf(res, r.num, r.den),
      ),
      pot: fmtG(res.pot), fee: fmtG(res.fee), prize: fmtG(prize),
      tie: win.length > 1 ? { share: fmtG(share), remainder: `${prize - share * win.length} ugnot` } : null,
      twoWhy,
      cancelHead: res.cancelled ? `Cancelled: ${res.revealers} of ${r.entries.length} revealed` : null,
    }
  }

  return {
    phase: ph,
    title: `${PRESETS[presetOfRound(r)].label} table · ${SKINS[r.skin]?.name ?? 'Oak table'}`,
    seatsText: `${r.entries.length} of ${MAX_PLAYERS} seats`,
    bestWithThree: r.entries.length < 3 && ph !== 'done',
    steps,
    showCountdown: ph === 'commit' || ph === 'reveal',
    countdownLabel: ph === 'commit' ? 'Commit window closes in' : ph === 'reveal' ? 'Reveal window closes in' : ph === 'settle' ? 'Windows closed. Waiting for Settle.' : 'Round settled',
    countdown: dur(left),
    live: ph === 'commit' ? `Commit window: ${bucket(left)}` : ph === 'reveal' ? `Reveal window: ${bucket(left)}` : ph === 'settle' ? 'Reveal window closed. Ready to settle.' : 'Round settled.',
    pot: fmtG(r.entries.length * ENTRY_FEE),
    skinNote: r.skin ? `Everyone at this table sees the ${SKINS[r.skin].name}.` : null,
    spectator: !me && ph !== 'done' ? (ph === 'commit' ? "You're watching as a visitor. Pick a number to take a seat." : "You're watching as a visitor.") : null,
    state,
    outcome,
    winnerName: w0 ? displayName(s, w0.addr, w0.name) : '',
    myPay: fmtG(myCredit),
    claimable: owed,
    claimLabel: oRefund ? `Claim refund · ${fmtG(s.claimable)} GNOT` : `Claim ${fmtG(s.claimable)} GNOT`,
    claimed: (iWin || oRefund) && s.claimable === 0,
    points,
    pointsBreak,
    join: { players: Math.min(MAX_PLAYERS, r.entries.length + 1), pot: fmtG(j.pot), fee: fmtG(j.fee), net: fmtG(j.net) },
    feeTable: [2, 5, 10].map((n) => { const b = breakdown(n); return { n, pot: fmtG(b.pot), fee: fmtG(b.fee), net: fmtG(b.net) } }),
    result,
  }
}
