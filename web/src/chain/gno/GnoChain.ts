// ChainClient for a real Gno chain: reads through vm/qeval on the RPC node, writes through a Signer.

import { GnoJSONRPCProvider } from '@gnolang/gno-js-client'
import { ENTRY_FEE, type ItemCode, type Look, type Slot } from '../../game/constants'
import { fmtG } from '../../game/format'
import type { Player, Round, WalletInfo } from '../../game/types'
import type { ChainClient, TxResult } from '../types'
import { hallFromBoards, itemId, slotIndex, toPlayer, toRound, type LeaderRowJSON, type PlayerJSON, type RoundJSON } from './mapping'
import { gnoStr, qAddress, qInt, qJSON } from './qeval'
import type { Signer } from './signers'

export interface GnoConfig {
  rpc: string
  network: string
  networkLabel: string
  realmPath: string
  signer: Signer
}

/**
 * Gas wanted per call, with headroom over local measurements (NewRound 7M, Join 11-18.5M, Reveal 13-14M,
 * Settle 22M at 4 seats; leaderboard index writes make Join, Reveal, Settle and Equip cost more).
 * The signer offers gasWanted / 1000 ugnot as the fee, so keep these tight.
 */
const GAS: Record<string, number> = {
  NewRound: 20_000_000, Join: 30_000_000, Reveal: 30_000_000, Settle: 80_000_000, Claim: 20_000_000,
  BuyItem: 20_000_000, Equip: 30_000_000, BuyFreeze: 20_000_000, BuySkin: 20_000_000, WithdrawFees: 20_000_000,
}

/** The realm function each Confirm-sheet action calls. */
const FUNC_OF: Record<string, string> = {
  join: 'Join', reveal: 'Reveal', settle: 'Settle', claim: 'Claim', create: 'NewRound',
  buy: 'BuyItem', skin: 'BuySkin', freeze: 'BuyFreeze', equip: 'Equip', withdraw: 'WithdrawFees',
}

/**
 * Network rows for the Confirm sheet. The dev key offers gas wanted / 1000 ugnot as the fee (the
 * chain's gas price); Adena sets its own fee when it signs. Every write may also pay a storage
 * deposit for the bytes it adds to the chain, which the chain computes at execution time.
 */
export function networkRows(kind: string, signer: 'dev-key' | 'adena'): [string, string][] {
  const gas = GAS[FUNC_OF[kind]]
  if (!gas) return []
  const fee = signer === 'adena' ? 'Set by Adena when you sign' : `${fmtG(Math.ceil(gas / 1000))} GNOT (gas)`
  return [
    ['Network fee', fee],
    ['Storage deposit', 'Set by the chain for the data this writes'],
  ]
}

/** Realm boards behind the Hall's tabs and its style gallery. */
const HALL_BOARDS = ['net', 'sharp', 'streak', 'points', 'style']

export class GnoChain implements ChainClient {
  readonly realmPath: string
  readonly network: string
  readonly networkLabel: string
  readonly walletName: string
  private readonly provider: Promise<GnoJSONRPCProvider>
  private readonly signer: Signer
  /** Looks change rarely; read each player's record at most every 30 s. */
  private looks = new Map<string, { look: Look; player: Player; at: number }>()

  constructor(c: GnoConfig) {
    this.realmPath = c.realmPath
    this.network = c.network
    this.networkLabel = c.networkLabel
    this.provider = GnoJSONRPCProvider.create(c.rpc)
    this.signer = c.signer
    this.walletName = c.signer.kind === 'adena' ? 'Adena' : 'the dev key'
  }

  networkRows(kind: string) { return networkRows(kind, this.signer.kind) }

  private async q(expr: string) {
    return (await this.provider).evaluateExpression(this.realmPath, expr)
  }

  private async playerJSON(addr: string): Promise<PlayerJSON> {
    return qJSON<PlayerJSON>(await this.q(`PlayerJSON(${gnoStr(addr)})`))
  }

  private async lookOf(addr: string): Promise<{ look: Look; player: Player }> {
    const hit = this.looks.get(addr)
    if (hit && Date.now() - hit.at < 30_000) return hit
    const p = toPlayer(await this.playerJSON(addr))
    const v = { look: p.equipped, player: p, at: Date.now() }
    this.looks.set(addr, v)
    return v
  }

  // ---------- reads ----------

  async getRounds(): Promise<Round[]> {
    const count = qInt(await this.q('RoundCount()'))
    const out: RoundJSON[] = []
    for (let off = 0; off < count; off += 100) out.push(...qJSON<RoundJSON[]>(await this.q(`RoundsJSON(${off}, 100)`)))
    const addrs = [...new Set(out.flatMap((r) => r.entries.map((e) => e.addr)))]
    const looks = new Map(await Promise.all(addrs.map(async (a) => [a, (await this.lookOf(a)).look] as const)))
    return out.map((r) => toRound(r, looks))
  }

  async getRound(id: number): Promise<Round> {
    const j = qJSON<RoundJSON>(await this.q(`RoundJSON(${id})`))
    const looks = new Map(await Promise.all(j.entries.map(async (e) => [e.addr, (await this.lookOf(e.addr)).look] as const)))
    return toRound(j, looks)
  }

  async getPlayer(addr: string): Promise<Player> {
    const p = toPlayer(await this.playerJSON(addr))
    this.looks.set(addr, { look: p.equipped, player: p, at: Date.now() })
    return p
  }

  async getClaimable(addr: string) { return qInt(await this.q(`Claimable(${gnoStr(addr)})`)) }
  async getFeesAccrued() { return qInt(await this.q('FeesAccrued()')) }
  async feeRecipient() { return qAddress(await this.q('FeeRecipient()')) }

  /** The realm ranks each board (top 50); merging them gives every regular a tab or the gallery can show. */
  async getHall() {
    const boards = await Promise.all(HALL_BOARDS.map(async (b) => qJSON<LeaderRowJSON[]>(await this.q(`LeaderboardJSON(${gnoStr(b)}, 50)`))))
    return hallFromBoards(boards)
  }

  /** Latest block time in seconds. */
  async now() {
    const st = await (await this.provider).getStatus()
    return Math.floor(Date.parse(st.sync_info.latest_block_time) / 1000)
  }

  // ---------- wallet ----------

  private async walletOf(acct: { address: string; network: string } | null): Promise<WalletInfo> {
    const installed = this.signer.installed()
    if (!acct) return { installed, connected: false, address: '', network: '', balance: 0 }
    const balance = await (await this.provider).getBalance(acct.address, 'ugnot').catch(() => 0)
    return { installed, connected: true, address: acct.address, network: acct.network, balance }
  }

  async getWallet() { return this.walletOf(await this.signer.account().catch(() => null)) }
  async connect() { return this.walletOf(await this.signer.connect()) }
  async reconnect() { await (await this.provider).getStatus() }

  get switchNetwork() { return this.signer.switchNetwork ? () => this.signer.switchNetwork!() : undefined }
  onWalletChange(cb: () => void) { this.signer.onChange?.(cb) }

  // ---------- writes ----------

  private async call(func: string, args: (string | number)[], send?: number): Promise<TxResult> {
    const res = await this.signer.call({ realm: this.realmPath, func, args: args.map(String), send, gasWanted: GAS[func] })
    if (res.ok) this.looks.clear() // a buy or equip changes a look; reads refill the cache
    return res
  }

  newRound(commitSecs: number, revealSecs: number, boardSkin: number) { return this.call('NewRound', [commitSecs, revealSecs, boardSkin]) }
  join(roundId: number, commit: string) { return this.call('Join', [roundId, commit], ENTRY_FEE) }
  reveal(roundId: number, pick: number, salt: string) { return this.call('Reveal', [roundId, pick, salt]) }
  settle(roundId: number) { return this.call('Settle', [roundId]) }
  claim() { return this.call('Claim', []) }
  buyItem(id: ItemCode) { return this.call('BuyItem', [itemId(id)]) }
  equip(slot: Slot, id: ItemCode | null) { return this.call('Equip', [slotIndex(slot), id ? itemId(id) : 0]) }
  buyFreeze() { return this.call('BuyFreeze', []) }
  buySkin(skin: number) { return this.call('BuySkin', [skin]) }
  withdrawFees() { return this.call('WithdrawFees', []) }
}

