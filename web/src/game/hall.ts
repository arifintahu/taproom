// Leaderboard rows computed from settled rounds and player records (the realm has no board view yet).

import { ENTRY_FEE } from './constants'
import { targetOf } from './rules'
import type { HallEntry, Player, Round } from './types'

export function hallFromRounds(rounds: Round[], players: Map<string, Player>): HallEntry[] {
  const st = new Map<string, { net: number; dist: number; n: number }>()
  for (const r of rounds) {
    const res = r.result
    if (!res) continue
    const target = targetOf(res, r.num, r.den)
    for (const e of r.entries) {
      const x = st.get(e.addr) ?? { net: 0, dist: 0, n: 0 }
      x.net += (res.credited[e.addr] ?? 0) - ENTRY_FEE
      if (!res.cancelled && e.revealed && e.pick !== null) {
        x.dist += Math.abs(e.pick - target)
        x.n++
      }
      st.set(e.addr, x)
    }
  }
  return [...st.entries()].map(([addr, x]) => {
    const p = players.get(addr)
    return { addr, look: p?.equipped ?? {}, net: x.net, sharp: x.n ? x.dist / x.n : null, streak: p?.streak ?? 0, points: p?.lifetime ?? 0 }
  })
}
