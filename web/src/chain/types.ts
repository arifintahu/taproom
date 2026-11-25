import type { ItemCode, Slot } from '../game/constants'
import type { HallEntry, Player, Round, Ugnot, WalletInfo } from '../game/types'

export type TxResult =
  | { ok: true; hash: string; height: number }
  | { ok: false; reason: string; rejected?: boolean }

/**
 * One interface for the UI. MockChain implements it now; GnoChain (Adena + RPC) comes in milestone 7.
 * Additions to handover 4.1: getWallet/connect (Adena connection), reconnect (RPC retry), getHall,
 * and item IDs as prototype codes until the on-chain ID scheme is confirmed.
 */
export interface ChainClient {
  /** Realm package path, e.g. gno.land/r/<owner>/taproom. */
  readonly realmPath: string
  /** Chain ID the wallet must be on. */
  readonly network: string
  /** Human label for the HUD chip, e.g. "Testnet onyx-1". */
  readonly networkLabel: string
  /** Who signs: "Adena", or "the dev key" on a local chain. */
  readonly walletName: string
  // reads
  getRounds(): Promise<Round[]>
  getRound(id: number): Promise<Round>
  getPlayer(addr: string): Promise<Player>
  getClaimable(addr: string): Promise<Ugnot>
  getFeesAccrued(): Promise<Ugnot>
  feeRecipient(): Promise<string>
  /** Leaderboard rows (not in the spike yet: the realm needs a view or Render() parsing). */
  getHall(): Promise<HallEntry[]>
  now(): Promise<number>
  // wallet
  getWallet(): Promise<WalletInfo>
  connect(): Promise<WalletInfo>
  reconnect(): Promise<void>
  /** Present when the wallet can be asked to switch to this chain (Adena, the mock). */
  switchNetwork?(): Promise<void>
  /** Present when the wallet reports account or network changes. */
  onWalletChange?(cb: () => void): void
  // writes
  newRound(commitSecs: number, revealSecs: number, boardSkin: number): Promise<TxResult>
  join(roundId: number, commit: string): Promise<TxResult>
  reveal(roundId: number, pick: number, salt: string): Promise<TxResult>
  settle(roundId: number): Promise<TxResult>
  claim(): Promise<TxResult>
  buyItem(itemId: ItemCode): Promise<TxResult>
  equip(slot: Slot, itemId: ItemCode | null): Promise<TxResult>
  buyFreeze(): Promise<TxResult>
  buySkin(skin: number): Promise<TxResult>
  withdrawFees(): Promise<TxResult>
}
