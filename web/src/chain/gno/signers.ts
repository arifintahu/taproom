// Who signs: a throwaway dev key (local gnodev only) or Adena.

import { GnoJSONRPCProvider, GnoWallet } from '@gnolang/gno-js-client'
import { TransactionEndpoint } from '@gnolang/tm2-js-client'
import type { TxResult } from '../types'

export interface Call {
  realm: string
  func: string
  args: string[]
  /** ugnot sent with the call (Join sends the entry fee). */
  send?: number
  gasWanted: number
}

export interface Signer {
  readonly kind: 'dev-key' | 'adena'
  installed(): boolean
  /** Connected address and the chain ID the signer is on, or null when not connected. */
  account(): Promise<{ address: string; network: string } | null>
  connect(): Promise<{ address: string; network: string } | null>
  call(c: Call): Promise<TxResult>
  /** Ask the wallet to move to this app's chain (Adena only). */
  switchNetwork?(): Promise<void>
  /** Called when the user changes account or network in the wallet. */
  onChange?(cb: () => void): void
}

/** Gas price on gno.land networks: 1 ugnot per 1,000 gas. */
const feeFor = (gasWanted: number) => `${Math.ceil(gasWanted / 1000)}ugnot`

/** Strip chain noise from an error down to the realm's panic message when there is one. */
export function reason(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)
  const panic = raw.match(/panic: ([^\n]+)/) ?? raw.match(/"([^"]*(?:panic|abort)[^"]*)"/i)
  if (panic) return panic[1].replace(/\\n.*/, '').trim()
  const data = raw.match(/Data: ([^\n]+)/)
  return (data ? data[1] : raw).slice(0, 240)
}

const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/

/**
 * A throwaway secp256k1 key generated in the browser and kept in localStorage, so rounds can be
 * played and tested on a local gnodev chain without a wallet extension. Refuses any non-local RPC.
 * Fund it with realm/scripts/local-fund.sh.
 */
export class DevKeySigner implements Signer {
  readonly kind = 'dev-key'
  private wallet: GnoWallet | null = null
  private provider: Promise<GnoJSONRPCProvider>
  private chainId = ''
  private readonly storageKey: string

  constructor(rpc: string, storageKey = 'taproom.devkey.v1') {
    if (!LOCAL.test(rpc)) throw new Error('The dev key only signs on a local chain (127.0.0.1).')
    this.storageKey = storageKey
    this.provider = GnoJSONRPCProvider.create(rpc)
  }

  installed() { return true }

  private async load(create: boolean): Promise<GnoWallet | null> {
    if (this.wallet) return this.wallet
    const hex = localStorage.getItem(this.storageKey)
    if (!hex && !create) return null
    // 32 bytes from Web Crypto (the library's createRandom needs Node's crypto).
    let key: Uint8Array
    if (hex) {
      key = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)))
    } else {
      key = crypto.getRandomValues(new Uint8Array(32))
      localStorage.setItem(this.storageKey, Array.from(key, (b) => b.toString(16).padStart(2, '0')).join(''))
    }
    const w = await GnoWallet.fromPrivateKey(key)
    const provider = await this.provider
    w.connect(provider)
    this.wallet = w
    this.chainId = (await provider.getStatus()).node_info.network
    return w
  }

  async account() {
    const w = await this.load(false)
    return w ? { address: await w.getAddress(), network: this.chainId } : null
  }

  async connect() {
    const w = await this.load(true)
    return w ? { address: await w.getAddress(), network: this.chainId } : null
  }

  async call(c: Call): Promise<TxResult> {
    const w = await this.load(false)
    if (!w) return { ok: false, reason: 'Wallet not connected.' }
    try {
      const funds = c.send ? new Map([['ugnot', c.send]]) : undefined
      const res = await w.callMethod(c.realm, c.func, c.args, TransactionEndpoint.BROADCAST_TX_COMMIT, funds, undefined, {
        gas_wanted: BigInt(c.gasWanted), gas_fee: feeFor(c.gasWanted),
      })
      return { ok: true, hash: res.hash, height: Number(res.height) }
    } catch (e) {
      return { ok: false, reason: reason(e) }
    }
  }

}

// ---------- Adena ----------
// API per docs.adena.app (read 2026-11-25). Every response is { code, status, type, message, data }.
// Verified in the extension on local gnodev (2026-11-25): AddEstablish, GetAccount, SwitchNetwork to the
// built-in "Local" network (dev, http://127.0.0.1:26657), DoContract with send and top-level gasFee/gasWanted.
// DoContract success differs from the docs: type TRANSACTION_SUCCESS, data { hash (64-char hex), Log, error, data },
// and no block height.

interface AdenaResponse<T> { status: 'success' | 'failure'; code?: number; type?: string; message?: string; data?: T }
interface AdenaApi {
  AddEstablish(name: string): Promise<AdenaResponse<unknown>>
  GetAccount(): Promise<AdenaResponse<{ address: string; chainId: string; status?: string }>>
  DoContract(req: { messages: { type: string; value: Record<string, unknown> }[]; gasFee: number; gasWanted: number; memo?: string }):
    Promise<AdenaResponse<{ hash: string; height?: string | number; Log?: string; error?: unknown }>>
  AddNetwork(n: { chainId: string; chainName: string; rpcUrl: string }): Promise<AdenaResponse<unknown>>
  SwitchNetwork(chainId: string): Promise<AdenaResponse<unknown>>
  On(event: 'changedAccount' | 'changedNetwork', cb: (v: string) => void): void
}
const adena = () => (globalThis as unknown as { adena?: AdenaApi }).adena

export interface AdenaNetwork { chainId: string; chainName: string; rpcUrl: string }

/** Tx hash as upper-case hex. Adena returned hex in practice; the docs say base64, so accept both. */
export function txHashHex(h: string): string {
  if (/^[0-9a-fA-F]{64}$/.test(h)) return h.toUpperCase()
  try {
    const bytes = atob(h)
    if (bytes.length === 32) return Array.from(bytes, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase()
  } catch {
    // not base64 either: show it as given
  }
  return h
}

const ADENA_REASON: Record<string, string> = {
  WALLET_LOCKED: 'Adena is locked. Unlock it and try again.',
  NOT_CONNECTED: 'Connect Adena first.',
  NO_ACCOUNT: 'Adena has no account. Create or import one first.',
  ACCOUNT_MISMATCH: 'Adena switched to another account. Reconnect and try again.',
  UNRESOLVED_TRANSACTION_EXISTS: 'Adena already has a request open. Finish or close it first.',
}

export class AdenaSigner implements Signer {
  readonly kind = 'adena'
  private readonly net: AdenaNetwork

  constructor(net: AdenaNetwork) {
    this.net = net
  }

  installed() { return !!adena() }

  async account() {
    const a = adena()
    if (!a) return null
    const r = await a.GetAccount()
    return r.status === 'success' && r.data ? { address: r.data.address, network: r.data.chainId } : null
  }

  async connect() {
    const a = adena()
    if (!a) return null
    const r = await a.AddEstablish('Taproom')
    // ALREADY_CONNECTED comes back as a failure but means the site is approved
    if (r.status !== 'success' && r.type !== 'ALREADY_CONNECTED') throw new Error(r.message || 'Connection rejected in Adena.')
    return this.account()
  }

  /** Switch Adena to this app's chain, adding the network first when Adena does not know it. */
  async switchNetwork(): Promise<void> {
    const a = adena()
    if (!a) throw new Error('Adena is not installed.')
    let r = await a.SwitchNetwork(this.net.chainId)
    if (r.status === 'success' || r.type === 'REDUNDANT_CHANGE_REQUEST') return
    if (r.type === 'UNADDED_NETWORK' || r.type === 'NOT_INITIALIZED_NETWORK') {
      const add = await a.AddNetwork(this.net)
      if (add.status !== 'success' && add.type !== 'NETWORK_ALREADY_EXISTS') throw new Error(add.message || 'Adding the network was rejected.')
      r = await a.SwitchNetwork(this.net.chainId)
      if (r.status === 'success' || r.type === 'REDUNDANT_CHANGE_REQUEST') return
    }
    throw new Error(r.message || 'Switching the network was rejected.')
  }

  onChange(cb: () => void) {
    const a = adena()
    a?.On('changedAccount', () => cb())
    a?.On('changedNetwork', () => cb())
  }

  async call(c: Call): Promise<TxResult> {
    const a = adena()
    const acct = await this.account()
    if (!a || !acct) return { ok: false, reason: 'Wallet not connected.' }
    const r = await a.DoContract({
      messages: [{
        type: '/vm.m_call',
        value: { caller: acct.address, send: c.send ? `${c.send}ugnot` : '', pkg_path: c.realm, func: c.func, args: c.args },
      }],
      gasFee: Math.ceil(c.gasWanted / 1000),
      gasWanted: c.gasWanted,
    })
    if (r.status === 'success' && r.data?.hash) return { ok: true, hash: txHashHex(r.data.hash), height: Number(r.data.height ?? 0) }
    if (r.type === 'TRANSACTION_REJECTED') return { ok: false, rejected: true, reason: 'You rejected the signature in Adena.' }
    const chainLog = typeof r.data?.Log === 'string' && r.data.Log ? r.data.Log : r.data?.error ? JSON.stringify(r.data.error) : ''
    return { ok: false, reason: ADENA_REASON[r.type ?? ''] ?? reason(chainLog || r.message || r.type || 'unknown error') }
  }
}
