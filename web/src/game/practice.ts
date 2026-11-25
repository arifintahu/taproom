// The Barkeep's practice game: no chain, about 20 seconds, five scripted regulars.

import { computeResult, avgOf, targetOf } from './rules'
import { BOTS, ME_ADDR } from '../chain/mock/bots'

export interface Practice {
  phase: 'idle' | 'pick' | 'sealed' | 'reveal' | 'result'
  pickRaw: string
  /** Wall-clock ms when the pick was locked. */
  t0: number
}

export const PRACTICE_PICKS = [50, 33, 67, 40, 25]

export function practiceList(pick: number) {
  return [{ name: 'You', addr: ME_ADDR, pick }].concat(PRACTICE_PICKS.map((v, i) => ({ name: BOTS[i].name, addr: BOTS[i].addr, pick: v })))
}

export function practiceResult(pick: number) {
  const list = practiceList(pick)
  const res = computeResult(list.map((e) => ({ ...e, revealed: true })), 2, 3)
  const w = list.find((e) => e.addr === res.winners[0])!
  return { list, res, avg: avgOf(res), target: targetOf(res), winners: res.winners, winnerName: w.name, winnerPick: w.pick }
}
