// Room scene layout in logical pixels (560 x 200), handover 6.1-6.2. The view multiplies by k.

import { MAX_PLAYERS, PRESETS, SKINS, type Look } from './constants'
import { dur } from './format'
import { phaseOf, streakState } from './rules'
import { connected, myEntry, presetOfRound, type Snapshot } from './selectors'
import type { Phase, Round } from './types'

export const ROOM_W = 560
export const ROOM_H = 200
export const TABLE_SLOTS = [205, 282, 359]

export interface Rect { x: number; y: number; w: number; h: number }
export type PlaceAction =
  | { kind: 'ledger' }
  | { kind: 'panel'; panel: 'regular' | 'hall' | 'hearth' | 'howto' | 'fees' | 'shop' }
  | { kind: 'round'; id: number }
  | { kind: 'create' }

export interface Hotspot { id: string; rect: Rect; tag: string; action: PlaceAction }
export interface Place { id: string; label: string; aria: string; action: PlaceAction }

export interface TableSlot {
  tx: number
  roundId: number | null
  skinKey: 'oak' | 'moon' | 'gold'
  gnomes: { addr: string; look: Look; rect: Rect }[]
  hourglass: 'full' | 'half' | null
  coins: 's' | 'm' | 'l' | null
  label: string
  labelColor: string
}

export type HearthState = 'lit' | 'low' | 'cold'

const PHASE_WORD: Record<Phase, string> = { commit: 'sealing', reveal: 'revealing', settle: 'ready to settle', done: 'settled' }

/** Up to 3 tables: open rounds, the selected one, and settled ones that still owe you coins. */
export function visibleRounds(s: Snapshot, selectedId: number | null): Round[] {
  return s.rounds
    .filter((r) => !r.settled || r.id === selectedId || (!!myEntry(s, r) && s.claimable > 0))
    .slice(0, TABLE_SLOTS.length)
}

export function tableSlots(s: Snapshot, selectedId: number | null): TableSlot[] {
  const vis = visibleRounds(s, selectedId)
  return TABLE_SLOTS.map((tx, i) => {
    const r = vis[i]
    if (!r) {
      return { tx, roundId: null, skinKey: 'oak', gnomes: [], hourglass: null, coins: null, label: 'Empty table', labelColor: 'var(--mu)' }
    }
    const ph = phaseOf(r, s.now)
    const J = r.entries
    const n = Math.min(4, J.length)
    const gnomes = J.slice(0, n).map((e, j) => ({ addr: e.addr, look: e.look, rect: { x: tx - 24 + (j - (n - 1) / 2) * 18, y: 113, w: 48, h: 48 } }))
    const left = ph === 'commit' ? `seal ${dur(r.commitEnd - s.now)}` : ph === 'reveal' ? `reveal ${dur(r.revealEnd - s.now)}` : ph === 'settle' ? 'settle' : 'done'
    const mine = !!myEntry(s, r)
    return {
      tx, roundId: r.id, skinKey: SKINS[r.skin]?.key ?? 'oak', gnomes,
      hourglass: ph === 'commit' ? 'full' : ph === 'reveal' ? 'half' : null,
      coins: J.length === 0 ? null : J.length <= 2 ? 's' : J.length <= 5 ? 'm' : 'l',
      label: `${mine ? 'Your seat · ' : ''}${PRESETS[presetOfRound(r)].label} · ${J.length}/${MAX_PLAYERS} · ${left}`,
      labelColor: mine ? 'var(--ok)' : ph === 'commit' ? 'var(--amber)' : 'var(--ink)',
    }
  })
}

export function roundTag(s: Snapshot, r: Round): string {
  return `${PRESETS[presetOfRound(r)].label} table · ${r.entries.length} of ${MAX_PLAYERS} · ${PHASE_WORD[phaseOf(r, s.now)]}`
}

export function hotspots(s: Snapshot, selectedId: number | null): Hotspot[] {
  const vis = visibleRounds(s, selectedId)
  const tables: Hotspot[] = TABLE_SLOTS.map((tx, i) => {
    const r = vis[i]
    return r
      ? { id: `table-${i}`, rect: { x: tx - 40, y: 108, w: 80, h: 86 }, tag: roundTag(s, r), action: { kind: 'round', id: r.id } }
      : { id: `table-${i}`, rect: { x: tx - 40, y: 110, w: 80, h: 84 }, tag: 'Empty table · Open a new table', action: { kind: 'create' } }
  })
  return [
    { id: 'ledger', rect: { x: 4, y: 76, w: 66, h: 102 }, tag: connected(s) ? 'Guest ledger · Wallet and settings' : 'Guest ledger · Connect wallet', action: { kind: 'ledger' } },
    { id: 'stairs', rect: { x: 72, y: 40, w: 50, h: 112 }, tag: 'Upstairs · My Regular', action: { kind: 'panel', panel: 'regular' } },
    { id: 'board', rect: { x: 124, y: 54, w: 44, h: 54 }, tag: 'Notice board · The Hall', action: { kind: 'panel', panel: 'hall' } },
    ...tables,
    { id: 'hearth', rect: { x: 394, y: 10, w: 56, h: 140 }, tag: 'Hearth · Weekly streak', action: { kind: 'panel', panel: 'hearth' } },
    { id: 'barkeep', rect: { x: 452, y: 58, w: 54, h: 116 }, tag: 'Barkeep · How to play', action: { kind: 'panel', panel: 'howto' } },
    { id: 'oil', rect: { x: 506, y: 94, w: 26, h: 30 }, tag: 'Lamp-oil jar · Fees', action: { kind: 'panel', panel: 'fees' } },
    { id: 'wardrobe', rect: { x: 532, y: 58, w: 28, h: 94 }, tag: "Tailor's wardrobe · Shop", action: { kind: 'panel', panel: 'shop' } },
  ]
}

/** The Places row: same destinations as the hotspots, as plain buttons (keyboard and narrow screens). */
export function places(s: Snapshot, selectedId: number | null): Place[] {
  const vis = visibleRounds(s, selectedId)
  // The accessible name starts with the visible label (WCAG 2.5.3), then says where it leads.
  const p = (id: string, label: string, detail: string, action: PlaceAction): Place => ({ id, label, aria: `${label}: ${detail}`, action })
  return [
    p('ledger', 'Ledger', connected(s) ? 'wallet and settings' : 'connect wallet', { kind: 'ledger' }),
    p('regular', 'My Regular', 'your gnome, upstairs', { kind: 'panel', panel: 'regular' }),
    p('hall', 'Hall', 'leaderboards on the notice board', { kind: 'panel', panel: 'hall' }),
    ...vis.map((r, i) => p(`table-${i}`, `Table ${i + 1}`, roundTag(s, r), { kind: 'round', id: r.id })),
    p('hearth', 'Hearth', 'weekly streak', { kind: 'panel', panel: 'hearth' }),
    p('barkeep', 'Barkeep', 'how to play', { kind: 'panel', panel: 'howto' }),
    p('fees', 'Fees jar', 'tavern fees', { kind: 'panel', panel: 'fees' }),
    p('shop', 'Tailor', 'shop for costumes and table skins', { kind: 'panel', panel: 'shop' }),
  ]
}

/** Not connected or streak running: full fire. At risk: low fire. Streak 0: embers and smoke. */
export function hearthState(s: Snapshot): HearthState {
  if (!connected(s) || !s.player) return 'lit'
  if (s.player.streak === 0) return 'cold'
  return streakState(s.player, s.now).atRisk ? 'low' : 'lit'
}

/** Room scale: k = min(2.6, (w - 36) / 560) at 1024 px and wider, else 2 (the room scrolls sideways). */
export const roomScale = (viewport: number, container: number) => (viewport >= 1024 ? Math.min(2.6, (container - 36) / ROOM_W) : 2)
