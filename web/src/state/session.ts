// The app store: chain snapshot + UI state + actions. React reads it with useSyncExternalStore;
// the dev scenarios drive the same actions, so tests and the UI share one code path.

import { ENTRY_FEE, ITEM, LINES, PRESETS, RANKS, SKINS, type ItemCode, type PresetId } from '../game/constants'
import { commitHash, newSalt } from '../game/commit'
import { fmtG, fmtN, shortAddr } from '../game/format'
import { avgOf, bonusOf, phaseOf, pickOk, rankOf, targetOf } from '../game/rules'
import * as sel from '../game/selectors'
import type { Round } from '../game/types'
import type { ChainClient, TxResult } from '../chain/types'
import type { MockChain } from '../chain/mock/MockChain'
import { BOTS } from '../chain/mock/bots'
import { type SaltStore } from './salts'
import { practiceResult, type Practice } from '../game/practice'

export type PanelId = 'regular' | 'hall' | 'hearth' | 'howto' | 'fees' | 'shop' | 'settings'
export type SheetId = 'connect' | 'create' | 'welcome'
export type ShopTab = 'hat' | 'outfit' | 'held' | 'companion' | 'skin' | 'freeze'
export type TxKind = 'join' | 'reveal' | 'settle' | 'claim' | 'create' | 'buy' | 'skin' | 'freeze' | 'equip' | 'withdraw'
export type TxStage = 'confirm' | 'broadcast' | 'confirmed' | 'failed' | 'rejected'

export interface PendingTx {
  n: number
  kind: TxKind
  title: string
  rows: sel.Rows
  stage: TxStage
  reason?: string
  hash?: string
  height?: number
}

export interface Toast { id: number; text: string; t: number }

export interface UiState {
  view: 'room' | 'table'
  panel: PanelId | null
  sheet: SheetId | null
  roundId: number | null
  pickRaw: string
  shopTab: ShopTab
  hallTab: 'net' | 'sharp' | 'streak' | 'points'
  create: { preset: PresetId; skin: number; fromShop: boolean }
  bark: string
  toasts: Toast[]
  tx: PendingTx | null
  lastTx: TxStage | null
  reduced: boolean
  landing: boolean
  connectPrompt: boolean
  practice: Practice
  /** Wall-clock ms of the last signature moment, keyed by effect (join, flip, slide, level, flame). */
  anim: Record<string, number>
  paused: boolean
  speed: number
  jumps: number
  /** Wall-clock ms of the last tick, for render-time checks of recent effects. */
  wall: number
}

export interface State { snap: sel.Snapshot; ui: UiState }

export interface SessionOptions {
  chain: ChainClient
  salts: SaltStore
  /** Present when the chain is the mock: the session then drives its clock. */
  mock?: MockChain
  wallNow?: () => number
  pollMs?: number
}

type Listener = () => void

const freshUi = (): UiState => ({
  view: 'room', panel: null, sheet: null, roundId: null, pickRaw: '50', shopTab: 'hat', hallTab: 'net',
  create: { preset: 'quick', skin: 0, fromShop: false }, bark: '', toasts: [], tx: null, lastTx: null,
  reduced: false, landing: false, connectPrompt: false, practice: { phase: 'idle', pickRaw: '40', t0: 0 },
  anim: {}, paused: false, speed: 1, jumps: 0, wall: 0,
})

const emptySnap = (): sel.Snapshot => ({
  now: 0, rounds: [], player: null, claimable: 0, fees: 0, feeRecipient: '', rpcOk: true, hall: [], realm: '', network: '', networkLabel: '', walletName: '',
  wallet: { installed: false, connected: false, address: '', network: '', balance: 0 },
})

export class Session {
  readonly chain: ChainClient
  readonly mock?: MockChain
  readonly salts: SaltStore
  private wallNow: () => number
  private state: State = { snap: emptySnap(), ui: freshUi() }
  private listeners = new Set<Listener>()
  private txSeq = 0
  private toastSeq = 0
  private refreshing: Promise<void> | null = null
  private lastWall = 0
  private lastPoll = 0
  /** Real chains: read every 3 s while the page is open, and on window focus. */
  private readonly pollMs: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(o: SessionOptions) {
    this.chain = o.chain
    this.mock = o.mock
    this.salts = o.salts
    this.wallNow = o.wallNow ?? Date.now
    this.pollMs = o.pollMs ?? 3000
  }

  // ---------- store plumbing ----------

  subscribe = (fn: Listener) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getState = () => this.state
  get snap() { return this.state.snap }
  get ui() { return this.state.ui }

  private setUi(patch: Partial<UiState> | ((u: UiState) => Partial<UiState>)) {
    const p = typeof patch === 'function' ? patch(this.state.ui) : patch
    this.state = { ...this.state, ui: { ...this.state.ui, ...p } }
    this.listeners.forEach((l) => l())
  }

  private setSnap(snap: sel.Snapshot) {
    this.state = { ...this.state, snap }
    this.listeners.forEach((l) => l())
  }

  toast(text: string) {
    const t = { id: ++this.toastSeq, text, t: this.wallNow() }
    this.setUi((u) => ({ toasts: [...u.toasts, t].slice(-3) }))
  }

  bark(line: string) { this.setUi({ bark: line }) }

  private mark(effect: string) { this.setUi((u) => ({ anim: { ...u.anim, [effect]: this.wallNow() } })) }

  // ---------- reads ----------

  /** Reads everything the scene needs and reports chain events (settles, freezes, rank ups). */
  refresh(): Promise<void> {
    if (!this.refreshing) this.refreshing = this.doRefresh().finally(() => (this.refreshing = null))
    return this.refreshing
  }

  private async doRefresh() {
    const prev = this.state.snap
    const wallet = await this.chain.getWallet()
    try {
      const addr = wallet.address
      const [now, rounds, fees, feeRecipient] = await Promise.all([
        this.chain.now(), this.chain.getRounds(), this.chain.getFeesAccrued(), this.chain.feeRecipient(),
      ])
      const on = wallet.installed && wallet.connected
      const [player, claimable] = on
        ? await Promise.all([this.chain.getPlayer(addr), this.chain.getClaimable(addr)])
        : [null, 0]
      const hall = this.ui.panel === 'hall' ? await this.chain.getHall() : prev.hall
      const c = this.chain
      const snap: sel.Snapshot = { now, rounds, player, claimable, fees, feeRecipient, wallet, rpcOk: true, hall, realm: c.realmPath, network: c.network, networkLabel: c.networkLabel, walletName: c.walletName }
      this.setSnap(snap)
      this.detectEvents(prev, snap)
    } catch {
      this.setSnap({ ...prev, wallet, rpcOk: false, realm: this.chain.realmPath, network: this.chain.network, networkLabel: this.chain.networkLabel, walletName: this.chain.walletName })
    }
  }

  private detectEvents(prev: sel.Snapshot, next: sel.Snapshot) {
    if (!prev.now) return
    const me = next.wallet.address
    for (const r of next.rounds) {
      const was = prev.rounds.find((x) => x.id === r.id)
      // Slips that just opened at the table on screen flip over.
      if (was && r.id === this.ui.roundId) {
        r.entries.forEach((e) => {
          if (e.revealed && !was.entries.find((w) => w.addr === e.addr)?.revealed) this.mark(`flip:${e.addr}`)
        })
      }
      if (!r.settled || !was || was.settled) continue
      const seated = r.entries.some((e) => e.addr === me)
      if (!seated && r.id !== this.ui.roundId) continue
      const by = r.result?.settledBy
      const prefix = by && by !== me ? `${this.nameOf(by)} pressed Settle. ` : ''
      this.bark(prefix + this.resultLine(r))
      this.mark('slide')
    }
    // A visitor watching a self-running table follows it to the next one unless coins are owed.
    const cur = next.rounds.find((r) => r.id === this.ui.roundId)
    if (cur?.settled && cur.nextId !== undefined && this.ui.view === 'table') {
      const owed = cur.entries.some((e) => e.addr === me) && next.claimable > 0
      if (!owed) this.setUi({ roundId: cur.nextId })
    }
    const a = prev.player
    const b = next.player
    if (a && b && a.addr === b.addr) {
      if (b.lifetime > a.lifetime) {
        this.toast(`+${b.lifetime - a.lifetime} points`)
        const ra = rankOf(a.lifetime)
        const rb = rankOf(b.lifetime)
        if (rb > ra) {
          this.mark('level')
          this.toast(`Rank up: ${RANKS[rb][1]}!`)
        }
      }
      if (b.streak === 0 && a.streak > 0) {
        const used = a.freezes
        this.bark(`Weeks were missed with ${used} freeze${used === 1 ? '' : 's'} held. The streak resets and your next round starts week 1.`)
        this.toast(used ? `Streak reset. ${used} freeze${used > 1 ? 's' : ''} used up.` : 'Streak reset.')
      } else if (b.freezes < a.freezes && b.streak === a.streak && b.lastWeek !== a.lastWeek) {
        const used = a.freezes - b.freezes
        this.bark(LINES.freeze)
        this.toast(used > 1 ? `${used} freezes kept your streak warm.` : LINES.freeze)
      }
    }
  }

  nameOf(addr: string): string {
    if (addr === this.snap.wallet.address) return 'You'
    return BOTS.find((b) => b.addr === addr)?.name ?? shortAddr(addr)
  }

  resultLine(r: Round): string {
    const res = r.result
    if (!res) return ''
    if (res.cancelled) return LINES.cancel
    const w = r.entries.find((e) => e.addr === res.winners[0])
    const main = LINES.result(fmtN(avgOf(res)), fmtN(targetOf(res, r.num, r.den)), this.nameOf(w?.addr ?? ''), w?.pick ?? 0)
    return res.winners.length > 1 ? `${LINES.tie} ${main}` : main
  }

  // ---------- clock ----------

  /**
   * One frame: advance the mock clock (or, on a real chain, count block time forward locally and
   * read the chain every pollMs), run the practice game, expire toasts.
   */
  async tick() {
    const t = this.wallNow()
    const dt = this.lastWall ? Math.min(1000, t - this.lastWall) : 0
    this.lastWall = t
    if (this.mock) {
      if (!this.ui.paused) this.mock.advance((dt / 1000) * this.ui.speed)
      await this.refresh()
    } else if (t - this.lastPoll >= this.pollMs) {
      this.lastPoll = t
      await this.refresh()
    } else if (this.snap.now) {
      this.setSnap({ ...this.snap, now: this.snap.now + dt / 1000 })
    }
    this.setUi({ wall: t })
    this.practiceTick(t)
    if (this.ui.toasts.some((x) => t - x.t >= 4500)) this.setUi((u) => ({ toasts: u.toasts.filter((x) => t - x.t < 4500) }))
  }

  start(intervalMs = 250) {
    if (this.timer) return
    this.lastWall = this.wallNow()
    void this.tick()
    this.timer = setInterval(() => void this.tick(), intervalMs)
    if (!this.mock && typeof window !== 'undefined') window.addEventListener('focus', () => void this.refresh())
    this.chain.onWalletChange?.(() => void this.refresh())
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  // ---------- navigation ----------

  currentRound(): Round | null {
    return this.snap.rounds.find((r) => r.id === this.ui.roundId) ?? null
  }

  openPanel(panel: PanelId) {
    this.setUi({ panel, sheet: null })
    if (panel === 'hall') void this.refresh()
  }
  setHallTab(hallTab: UiState['hallTab']) { this.setUi({ hallTab }) }
  /** Shop "Back to New table" after buying the skin the sheet asked for. */
  backToCreate() { this.setUi({ panel: null, sheet: 'create' }) }
  closePanel() { this.setUi({ panel: null }) }
  openSheet(sheet: SheetId) { this.setUi({ sheet }) }
  closeSheet() { this.setUi({ sheet: null }) }
  openRound(id: number) { this.setUi({ view: 'table', roundId: id, panel: null, sheet: null }) }
  backToRoom() { this.setUi({ view: 'room', panel: null, sheet: null }) }
  openCreate() { this.setUi({ view: 'room', panel: null, sheet: 'create' }) }
  setCreate(patch: Partial<UiState['create']>) { this.setUi((u) => ({ create: { ...u.create, ...patch } })) }
  setShopTab(shopTab: ShopTab) { this.setUi({ shopTab }) }
  toShopSkins() { this.setUi((u) => ({ sheet: null, panel: 'shop', shopTab: 'skin', create: { ...u.create, fromShop: true } })) }
  setPickRaw(pickRaw: string) { this.setUi({ pickRaw }) }
  /** Minus/plus buttons: step the pick by one within 0..100. */
  stepPick(d: number) {
    const v = pickOk(this.ui.pickRaw) ? Number(this.ui.pickRaw) : 0
    this.setUi({ pickRaw: String(Math.min(100, Math.max(0, v + d))) })
  }
  /** Play again: the next open table still taking seats, else the New table sheet. */
  playAgain() {
    const me = this.snap.wallet.address
    const open = this.snap.rounds.find((r) => r.id !== this.ui.roundId && phaseOf(r, this.snap.now) === 'commit' && !r.entries.some((e) => e.addr === me))
    if (open) this.openRound(open.id)
    else this.openCreate()
  }
  setReduced(reduced: boolean) { this.setUi({ reduced }) }
  ledger() {
    if (sel.connected(this.snap)) this.openPanel('settings')
    else this.openSheet('connect')
  }

  // ---------- wallet ----------

  async connect() {
    let w
    try {
      w = await this.chain.connect()
    } catch (e) {
      this.toast(`Could not connect: ${(e as Error).message}`)
      return
    }
    if (!w.connected) return
    this.setUi({ sheet: null, landing: false, connectPrompt: false })
    this.toast('Wallet connected: ' + w.address)
    await this.refresh()
  }

  /** "I installed it, check again". The mock fakes the install. */
  async recheckWallet() {
    if (this.mock) this.mock.wallet.installed = true
    await this.refresh()
  }

  /** Mock only: the real faucet is faucet.gno.land. */
  async faucet() {
    if (!this.mock) return
    this.mock.wallet.balance += 10 * ENTRY_FEE
    await this.refresh()
    this.toast('Faucet sent 10 GNOT (simulated).')
  }

  /** Whether the wrong-network banner can offer a Switch button. */
  get canSwitchNetwork() { return !!this.mock || !!this.chain.switchNetwork }

  /** Ask the wallet to move to this chain (Adena adds the network first if needed); the mock fakes it. */
  async switchNetwork() {
    try {
      if (this.mock) this.mock.wallet.network = this.chain.network
      else if (this.chain.switchNetwork) await this.chain.switchNetwork()
      else return
    } catch (e) {
      this.toast(`Could not switch: ${(e as Error).message}`)
      return
    }
    await this.refresh()
    this.toast(`${this.chain.walletName === 'Adena' ? 'Adena' : 'The wallet'} switched to ${this.chain.networkLabel}.`)
  }

  async retry() {
    await this.chain.reconnect()
    await this.refresh()
    if (this.snap.rpcOk) this.toast(`Back online: the ${this.chain.networkLabel} node answered.`)
  }

  // ---------- writes: every one opens the Confirm sheet first ----------

  private runner: (() => Promise<TxResult>) | null = null
  private after: (() => void) | null = null

  private request(kind: TxKind, title: string, rows: sel.Rows, run: () => Promise<TxResult>, after?: () => void) {
    rows = [...rows, ...(this.chain.networkRows?.(kind) ?? [])]
    this.runner = run
    this.after = after ?? null
    this.setUi({ tx: { n: ++this.txSeq, kind, title, rows, stage: 'confirm' } })
  }

  /** Approve in the Confirm sheet: only now does the wallet sign and broadcast. */
  async approve() {
    const tx = this.ui.tx
    if (!tx || tx.stage !== 'confirm' || !this.runner) return
    this.setUi({ tx: { ...tx, stage: 'broadcast' } })
    const res = await this.runner()
    if (res.ok) {
      this.setUi({ tx: { ...tx, stage: 'confirmed', hash: res.hash, height: res.height }, lastTx: 'confirmed' })
      await this.refresh()
      this.after?.()
    } else {
      const stage: TxStage = res.rejected ? 'rejected' : 'failed'
      this.setUi({ tx: { ...tx, stage, reason: res.reason }, lastTx: stage })
    }
  }

  reject() {
    const tx = this.ui.tx
    if (tx && tx.stage === 'confirm') this.setUi({ tx: { ...tx, stage: 'rejected' }, lastTx: 'rejected' })
  }

  closeTx() {
    if (this.ui.tx?.stage !== 'broadcast') this.setUi({ tx: null })
  }

  retryTx() {
    const tx = this.ui.tx
    if (tx && (tx.stage === 'failed' || tx.stage === 'rejected')) this.setUi({ tx: { ...tx, n: ++this.txSeq, stage: 'confirm', reason: undefined } })
  }

  requestJoin(): boolean {
    const r = this.currentRound()
    if (!r || sel.myEntry(this.snap, r) || sel.joinBlock(this.snap, r) || !pickOk(this.ui.pickRaw)) return false
    const pick = Number(this.ui.pickRaw)
    const salt = newSalt()
    const address = this.snap.wallet.address
    this.request('join', 'Join the table and seal your pick', sel.joinRows(r, this.chain.realmPath), async () => {
      this.salts.save({ realm: this.chain.realmPath, roundId: r.id, address, pick, salt })
      return this.chain.join(r.id, commitHash(r.id, address, pick, salt))
    }, () => {
      this.mark('join')
      this.bark(LINES.sealed)
      this.toast('Pick sealed. 1 GNOT dropped into the pot.')
    })
    return true
  }

  requestReveal(): boolean {
    const r = this.currentRound()
    const me = sel.myEntry(this.snap, r)
    if (!r || !me || me.revealed || phaseOf(r, this.snap.now) !== 'reveal' || sel.realmBlock(this.snap)) return false
    const rec = this.salts.get(this.chain.realmPath, r.id, this.snap.wallet.address)
    if (!rec) {
      this.toast('No saved pick for this table on this device. Import your backup in Settings.')
      return false
    }
    const before = this.snap.player?.streak ?? 0
    this.request('reveal', 'Reveal your pick', sel.revealRows(rec.pick, this.chain.realmPath), () => this.chain.reveal(r.id, rec.pick, rec.salt), () => {
      this.bark(`Revealed ${rec.pick}. Now we wait for the others.`)
      const s = this.snap.player?.streak ?? 0
      if (s > before) {
        this.mark('flame')
        this.toast(`Flame +1: ${s} week${s > 1 ? 's' : ''}. Bonus per round: ${bonusOf(s)}.`)
      }
    })
    return true
  }

  requestSettle(): boolean {
    const r = this.currentRound()
    if (!r || phaseOf(r, this.snap.now) !== 'settle' || sel.realmBlock(this.snap)) return false
    this.request('settle', 'Settle the round', sel.settleRows(r, this.chain.realmPath), () => this.chain.settle(r.id))
    return true
  }

  requestClaim(): boolean {
    const amt = this.snap.claimable
    if (!amt || sel.realmBlock(this.snap)) return false
    const r = this.currentRound()
    const refund = !!r?.result?.cancelled && amt === ENTRY_FEE
    this.request('claim', refund ? 'Claim your refund' : 'Claim your winnings', sel.claimRows(amt, refund, this.snap.wallet.address),
      () => this.chain.claim(), () => this.toast(`Claimed ${fmtG(amt)} GNOT.`))
    return true
  }

  requestCreate(): boolean {
    const { preset, skin } = this.ui.create
    if (sel.createBlock(this.snap, skin)) return false
    const p = PRESETS[preset]
    const before = this.snap.rounds.length
    this.request('create', 'Open a new table', sel.createRows(preset, skin, this.chain.realmPath), () => this.chain.newRound(p.commitSecs, p.revealSecs, skin), () => {
      const n = this.snap.rounds[before]
      this.setUi((u) => ({ create: { ...u.create, fromShop: false } }))
      if (n) this.openRound(n.id)
      this.toast(`Table open: ${SKINS[skin].name}.`)
      this.bark(skin ? `Fancy. Everyone at this table sees the ${SKINS[skin].name}.` : 'Table is open. Regulars will drift in.')
    })
    return true
  }

  requestBuy(id: ItemCode): boolean {
    if (this.snap.player?.owned.includes(id) || sel.buyBlock(this.snap, ITEM[id].price)) return false
    this.request('buy', 'Buy ' + ITEM[id].name, sel.buyRows(id), () => this.chain.buyItem(id),
      () => this.toast(ITEM[id].name + ' is yours. Equip it to wear it.'))
    return true
  }

  requestSkin(skin: number): boolean {
    if (this.snap.player?.skins.includes(skin) || sel.buyBlock(this.snap, SKINS[skin].price)) return false
    this.request('skin', 'Buy the ' + SKINS[skin].name, sel.skinRows(skin), () => this.chain.buySkin(skin),
      () => this.toast(`${SKINS[skin].name} unlocked for your tables.`))
    return true
  }

  requestFreeze(): boolean {
    if (sel.freezeBlock(this.snap)) return false
    this.request('freeze', 'Buy a streak freeze', sel.freezeRows(this.snap.player?.freezes ?? 0), () => this.chain.buyFreeze(),
      () => this.toast(`Freeze bought. You hold ${this.snap.player?.freezes ?? 0} of 2.`))
    return true
  }

  requestEquip(id: ItemCode, on: boolean): boolean {
    if (sel.realmBlock(this.snap)) return false
    const it = ITEM[id]
    this.request('equip', (on ? 'Equip ' : 'Take off ') + it.name, sel.equipRows(id, on), () => this.chain.equip(it.slot, on ? id : null),
      () => this.toast((on ? 'Equipped ' : 'Took off ') + it.name + '.'))
    return true
  }

  requestWithdraw(): boolean {
    const fees = this.snap.fees
    if (!sel.isOwner(this.snap) || !fees || sel.realmBlock(this.snap)) return false
    this.request('withdraw', 'Withdraw fees', sel.withdrawRows(fees, this.snap.feeRecipient), () => this.chain.withdrawFees(),
      () => this.toast(`Withdrew ${fmtG(fees)} GNOT to the treasury.`))
    return true
  }

  // ---------- practice game (no chain) ----------

  practiceStart() {
    this.setUi({ panel: 'howto', sheet: null, practice: { phase: 'pick', pickRaw: '40', t0: 0 }, bark: 'Five regulars are waiting. Pick your number.' })
  }

  practiceSetPick(pickRaw: string) { this.setUi((u) => ({ practice: { ...u.practice, pickRaw } })) }

  practiceLock() {
    const p = this.ui.practice
    if (p.phase !== 'pick' || !pickOk(p.pickRaw)) return
    this.setUi({ practice: { ...p, phase: 'sealed', t0: this.wallNow() }, bark: LINES.sealed })
  }

  /** Skip the practice clock forward (guided mode and tests). */
  practiceSkip(ms: number) {
    const p = this.ui.practice
    this.setUi({ practice: { ...p, t0: p.t0 - ms } })
    this.practiceTick(this.wallNow())
  }

  practiceTick(t: number) {
    const p = this.ui.practice
    if (p.phase !== 'sealed' && p.phase !== 'reveal') return
    const el = t - p.t0
    const phase = el < 9000 ? 'sealed' : el < 18000 ? 'reveal' : 'result'
    if (phase === p.phase) return
    const patch: Partial<UiState> = { practice: { ...p, phase } }
    if (phase === 'result') {
      const rr = practiceResult(Number(p.pickRaw))
      patch.bark = LINES.result(fmtN(rr.avg), fmtN(rr.target), rr.winnerName, rr.winnerPick)
    }
    this.setUi(patch)
  }

  showConnectPrompt() { this.setUi({ connectPrompt: true }) }

  // ---------- dev (mock only) ----------

  setDev(patch: Partial<Pick<UiState, 'paused' | 'speed' | 'landing' | 'jumps'>>) { this.setUi(patch) }
}
