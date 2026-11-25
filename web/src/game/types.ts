import type { ItemCode, Look, Slot } from './constants'

/** Amounts in ugnot. Values stay below Number.MAX_SAFE_INTEGER for any realistic pot. */
export type Ugnot = number

export interface Entry {
  addr: string
  /** Display name for scripted regulars; real players show a short address. */
  name?: string
  look: Look
  revealed: boolean
  /** Known only after reveal. */
  pick: number | null
  /** Streak bonus recorded at reveal. */
  bonus: number
}

export interface RoundResult {
  pot: Ugnot
  fee: Ugnot
  cancelled: boolean
  revealers: number
  /** Sum of revealed picks, so avg = sum / revealers and target = 2 * sum / (3 * revealers). */
  sum: number
  winners: string[]
  /** Amount credited per address at settle. */
  credited: Record<string, Ugnot>
  settledBy?: string
}

export interface Round {
  id: number
  creator: string
  skin: number
  start: number
  commitEnd: number
  revealEnd: number
  num: number
  den: number
  /** In join order. */
  entries: Entry[]
  settled: boolean
  result: RoundResult | null
  /** Mock judge tables only: the table that replaced this one. */
  nextId?: number
}

export interface Player {
  addr: string
  lifetime: number
  spent: number
  streak: number
  lastWeek: number | null
  freezes: number
  owned: ItemCode[]
  equipped: Partial<Record<Slot, ItemCode>>
  skins: number[]
}

/** One regular on the Hall boards. */
export interface HallEntry {
  addr: string
  name?: string
  look: Look
  /** Net coins won minus entries paid, ugnot (can be negative). */
  net: Ugnot
  /** Average distance to the target over completed revealed rounds; null before the first one. */
  sharp: number | null
  streak: number
  points: number
}

export type Phase = 'commit' | 'reveal' | 'settle' | 'done'

export interface WalletInfo {
  installed: boolean
  connected: boolean
  address: string
  network: string
  balance: Ugnot
}
