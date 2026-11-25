// Pure derived values for the UI: blockers (with the reason shown next to a disabled button),
// confirm-sheet rows and the room layout.

import {
  ENTRY_FEE, FREEZE_COST, ITEM, MAX_FREEZES, MAX_OPEN_ROUNDS, MAX_PLAYERS, PRESETS, RARITY,
  SKINS, presetOf, type ItemCode, type PresetId,
} from './constants'
import { breakdown, phaseOf, spendable } from './rules'
import { fmtG } from './format'
import type { HallEntry, Player, Round, Ugnot, WalletInfo } from './types'

export interface Snapshot {
  now: number
  rounds: Round[]
  player: Player | null
  claimable: Ugnot
  fees: Ugnot
  feeRecipient: string
  wallet: WalletInfo
  rpcOk: boolean
  /** Read only while the Hall window is open. */
  hall: HallEntry[]
  /** From the chain client: realm path, expected chain ID and its label. */
  realm: string
  network: string
  networkLabel: string
  walletName: string
}

export const connected = (s: Snapshot) => s.wallet.installed && s.wallet.connected
export const meAddr = (s: Snapshot) => s.wallet.address
export const myEntry = (s: Snapshot, r: Round | null | undefined) =>
  r && connected(s) ? r.entries.find((e) => e.addr === s.wallet.address) ?? null : null
export const isOwner = (s: Snapshot) => connected(s) && s.wallet.address === s.feeRecipient
export const presetOfRound = (r: Round): PresetId => presetOf(r.commitEnd - r.start)

export function realmBlock(s: Snapshot): string {
  if (!connected(s)) return 'Connect your wallet first.'
  if (!s.rpcOk) return "Can't reach the network. Press Retry in the red banner."
  if (s.wallet.network !== s.network) return `Switch ${s.walletName} to ${s.networkLabel} first.`
  return ''
}

export function joinBlock(s: Snapshot, r: Round): string {
  const b = realmBlock(s)
  if (b) return b
  if (phaseOf(r, s.now) !== 'commit') return 'The commit window is closed.'
  if (r.entries.length >= MAX_PLAYERS) return `This table is full (${MAX_PLAYERS} of ${MAX_PLAYERS}).`
  if (s.wallet.balance < ENTRY_FEE)
    return `You need 1 GNOT. Balance ${fmtG(s.wallet.balance)} GNOT: ${fmtG(ENTRY_FEE - s.wallet.balance)} GNOT short.`
  return ''
}

export function buyBlock(s: Snapshot, price: number): string {
  const b = realmBlock(s)
  if (b) return b
  const sp = s.player ? spendable(s.player) : 0
  return sp < price ? `Need ${price - sp} more points.` : ''
}

export function freezeBlock(s: Snapshot): string {
  if (s.player && s.player.freezes >= MAX_FREEZES) return `You hold ${MAX_FREEZES} freezes, the most allowed.`
  return buyBlock(s, FREEZE_COST)
}

export function createBlock(s: Snapshot, skin: number | null): string {
  const b = realmBlock(s)
  if (b) return b
  const open = s.rounds.filter((r) => r.creator === s.wallet.address && !r.settled).length
  if (open >= MAX_OPEN_ROUNDS) return `You already have ${MAX_OPEN_ROUNDS} open tables. Settle one first.`
  if (skin !== null && !(s.player?.skins ?? [0]).includes(skin)) {
    const k = SKINS[skin]
    return `Locked: the ${k.name} costs ${k.price} points. Buy it in the Shop first.`
  }
  return ''
}

// ---------- confirm-sheet rows (shown before every signature) ----------

export type Rows = [string, string][]

export function joinRows(r: Round, realm: string): Rows {
  const { pot, fee, net } = breakdown(Math.min(MAX_PLAYERS, r.entries.length + 1))
  return [
    ['Action', 'Join and commit a sealed pick'],
    ['Amount', '1 GNOT'],
    ['To', 'Taproom realm'],
    ['Realm', realm],
    ['Pot after you join', fmtG(pot) + ' GNOT'],
    ['Tavern fee (0.5%, completed rounds)', fmtG(fee) + ' GNOT'],
    ['Winner receives', fmtG(net) + ' GNOT'],
    ['Your pick', 'Sealed: only a hash goes on chain'],
  ]
}

export const revealRows = (pick: number, realm: string): Rows => [
  ['Action', `Reveal your pick (${pick})`],
  ['Amount', '0 GNOT: no coins move'],
  ['To', 'Taproom realm'],
  ['Realm', realm],
]

export function settleRows(r: Round, realm: string): Rows {
  const J = r.entries.length
  const R = r.entries.filter((e) => e.revealed).length
  return [
    ['Action', 'Settle the round'],
    ['Amount', '0 GNOT from you'],
    ['Reveals', `${R} of ${J}`],
    ['Outcome', R >= 2 ? `Completed. Fee ${fmtG(breakdown(J).fee)} GNOT to the owner's treasury` : 'Cancelled. Everyone refunded, no fee'],
    ['Realm', realm],
  ]
}

export const claimRows = (amount: Ugnot, refund: boolean, addr: string): Rows => [
  ['Action', refund ? 'Claim refund' : 'Claim winnings'],
  ['Amount', fmtG(amount) + ' GNOT'],
  ['From', 'Taproom realm'],
  ['To', 'Your address ' + addr],
]

export const createRows = (preset: PresetId, skin: number, realm: string): Rows => [
  ['Action', 'Open a table'],
  ['Window', `${PRESETS[preset].label}: ${PRESETS[preset].desc}`],
  ['Board skin', SKINS[skin].name],
  ['Target', '2/3 of the average (fixed)'],
  ['Amount', '0 GNOT. Seats cost 1 GNOT each.'],
  ['Realm', realm],
]

export const buyRows = (id: ItemCode): Rows => [
  ['Action', 'Buy ' + ITEM[id].name],
  ['Rarity', RARITY[ITEM[id].rarity].word],
  ['Cost', ITEM[id].price + ' points. No coins move.'],
  ['To', 'Taproom realm'],
]

export const skinRows = (skin: number): Rows => [
  ['Action', 'Buy board skin'],
  ['Skin', SKINS[skin].name],
  ['Cost', SKINS[skin].price + ' points. No coins move.'],
  ['To', 'Taproom realm'],
]

export const freezeRows = (held: number): Rows => [
  ['Action', 'Buy streak freeze'],
  ['Cost', `${FREEZE_COST} points. No coins move.`],
  ['Held after', `${held + 1} of ${MAX_FREEZES}`],
  ['To', 'Taproom realm'],
]

export const equipRows = (id: ItemCode, on: boolean): Rows => [
  ['Action', (on ? 'Equip ' : 'Unequip ') + ITEM[id].name],
  ['Slot', ITEM[id].slot],
  ['Amount', '0 GNOT, 0 points'],
]

export const withdrawRows = (fees: Ugnot, owner: string): Rows => [
  ['Action', 'WithdrawFees'],
  ['Amount', fmtG(fees) + ' GNOT'],
  ['From', 'Taproom realm'],
  ['To', "Owner's treasury " + owner],
]
