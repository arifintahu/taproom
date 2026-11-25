// Scenarios S1-S13 (with S10a-f). Each seeds a fresh MockChain and
// lists guided steps: `done` says when a step is complete, `act` performs it (the guided Next button).

import { ENTRY_FEE, LINES, NETWORK } from '../game/constants'
import { humanLong } from '../game/format'
import { weekEnd, weekOf } from '../game/rules'
import * as sel from '../game/selectors'
import { MockChain, type SeedEntry } from '../chain/mock/MockChain'
import { OWNER_ADDR } from '../chain/mock/bots'
import { Session } from '../state/session'
import { MemorySaltStore, type SaltStore } from '../state/salts'

export interface Ctx { session: Session; mock: MockChain }

export interface Step {
  t: string
  h?: string
  /** Hotspot or control to pulse in guided mode. */
  target?: string | ((x: Ctx) => string)
  wait?: boolean
  done?: (x: Ctx) => boolean
  act?: (x: Ctx) => Promise<void>
}

export interface Scenario {
  id: string
  code: string
  name: string
  desc: string
  sub?: boolean
  seed: (x: Ctx) => void | Promise<void>
  steps: Step[]
}

// ---------- helpers ----------

const U = ENTRY_FEE
const cur = (x: Ctx) => x.session.currentRound()
const me = (x: Ctx) => sel.myEntry(x.session.snap, cur(x))
const wk = (x: Ctx) => weekOf(x.mock.clock)
const conn = (x: Ctx, bal: number) => {
  x.mock.wallet.connected = true
  x.mock.wallet.balance = bal
}
/** Seat "you" in a seeded round with a stored salt, as if you had joined earlier on this device. */
const meSeat = (x: Ctx, roundId: number, pick: number): SeedEntry => {
  const salt = `seed-salt-${roundId}-0123456789`
  x.session.salts.save({ realm: x.mock.realmPath, roundId, address: x.mock.wallet.address, pick, salt })
  return { me: true, pick, salt }
}
const nextId = (x: Ctx) => x.mock.rounds.length
const live = (x: Ctx) =>
  x.mock.addRound({
    start: x.mock.clock - 25,
    entries: [{ bot: 0, pick: 34, joined: true, revealAt: 12 }, { bot: 1, pick: 51, joinAt: 8, revealAt: 30 }, { bot: 2, pick: 27, joinAt: 60, revealAt: 50 }],
  })
const sync = async (x: Ctx) => { await x.session.refresh() }
const confirm = async (x: Ctx, requested: boolean) => { if (requested) await x.session.approve() }
const skip = async (x: Ctx, to: 'reveal' | 'settle') => {
  let r = cur(x)
  if (!r || r.settled) r = x.session.snap.rounds.find((q) => !q.settled) ?? null
  if (r) x.mock.skipTo(r.id, to)
  await sync(x)
}

const D = {
  onRound: (x: Ctx) => x.session.ui.view === 'table' && !!cur(x),
  joined: (x: Ctx) => !!me(x),
  inReveal: (x: Ctx) => { const r = cur(x); return !!r && (r.settled || x.session.snap.now >= r.commitEnd) },
  revealed: (x: Ctx) => !!me(x)?.revealed,
  inSettle: (x: Ctx) => { const r = cur(x); return !!r && (r.settled || x.session.snap.now >= r.revealEnd) },
  settled: (x: Ctx) => !!cur(x)?.settled,
  claimed: (x: Ctx) => !!cur(x)?.settled && x.session.snap.claimable === 0,
}

const A = {
  open: async (x: Ctx) => { x.session.openRound(x.session.snap.rounds[0].id) },
  lock: async (x: Ctx) => {
    x.session.closeTx()
    x.session.openRound((cur(x) ?? x.session.snap.rounds[0]).id)
    await confirm(x, x.session.requestJoin())
  },
  reveal: async (x: Ctx) => { x.session.closeTx(); await confirm(x, x.session.requestReveal()) },
  settle: async (x: Ctx) => { x.session.closeTx(); await confirm(x, x.session.requestSettle()) },
  claim: async (x: Ctx) => { x.session.closeTx(); await confirm(x, x.session.requestClaim()) },
  jump: async (x: Ctx, k: number) => {
    x.mock.jumpWeeks(k)
    x.session.setDev({ jumps: x.session.ui.jumps + 1 })
    await sync(x)
  },
  /** Judge tables settle themselves 3 s after the reveal window (a regular presses Settle). */
  judgeSettle: async (x: Ctx) => {
    await skip(x, 'settle')
    const r = cur(x)
    if (r && !r.settled) x.mock.advance(3)
    await sync(x)
  },
}

const ST = {
  open: (h?: string): Step => ({ t: 'Open the Quick table', h, target: 'openTable', done: D.onRound, act: A.open }),
  lock: (p: number, h?: string): Step => ({
    t: 'Lock your pick: ' + p,
    h: h ?? 'Joining sends the 1 GNOT entry fee and seals your number. Check the breakdown, then approve.',
    target: 'lock', done: D.joined, act: A.lock,
  }),
  waitR: { t: 'Wait for the reveal window', h: 'Waiting step: the clock skips ahead for you.', wait: true, done: D.inReveal, act: (x: Ctx) => skip(x, 'reveal') } as Step,
  reveal: { t: 'Reveal your pick', h: 'Revealing costs no coins. Miss the window and your deposit stays in the pot.', target: 'reveal', done: D.revealed, act: A.reveal } as Step,
  waitS: { t: 'Wait for the others to reveal', h: 'Waiting step: the clock skips to the end of the reveal window.', wait: true, done: D.inSettle, act: (x: Ctx) => skip(x, 'settle') } as Step,
  settle: { t: 'Settle the round', h: 'Anyone, even a visitor, can press Settle.', target: 'settle', done: D.settled, act: A.settle } as Step,
}

// ---------- scenarios ----------

export const SCENARIOS: Scenario[] = [
  {
    id: 's1', code: 'S1', name: 'First visit, no wallet',
    desc: 'Landing, a 20-second practice round against 5 bots, the result chart, then the wallet prompt.',
    seed(x) { x.session.setDev({ landing: true }); live(x); x.session.bark('Pull up a stool. The first round is free: practice costs nothing.') },
    steps: [
      { t: 'Start a practice round', h: 'No wallet, no coins. Five scripted regulars play against you.', target: 'practice',
        done: (x) => x.session.ui.practice.phase !== 'idle', act: async (x) => x.session.practiceStart() },
      { t: 'Pick a number and lock it', h: 'Aim for 2/3 of what you think the crowd will average.', target: 'pracLock',
        done: (x) => ['sealed', 'reveal', 'result'].includes(x.session.ui.practice.phase),
        act: async (x) => { if (x.session.ui.practice.phase === 'idle') x.session.practiceStart(); x.session.practiceLock() } },
      { t: 'Watch the regulars seal and reveal', h: 'About 20 seconds. Cards flip one by one.', wait: true,
        done: (x) => x.session.ui.practice.phase === 'result',
        act: async (x) => {
          if (x.session.ui.practice.phase === 'idle') x.session.practiceStart()
          if (x.session.ui.practice.phase === 'pick') x.session.practiceLock()
          x.session.practiceSkip(18_000)
        } },
      { t: 'Read the result chart', h: 'Dashed line: the average. Teal marker: 2/3 of it. The crown marks the winner.', target: 'pracDone',
        done: (x) => x.session.ui.connectPrompt, act: async (x) => x.session.showConnectPrompt() },
      { t: 'Connect your wallet', h: 'Adena is detected. Approve the connection.', target: (x) => (x.session.ui.sheet === 'connect' ? 'connectOk' : 'connect'),
        done: (x) => sel.connected(x.session.snap), act: (x) => x.session.connect() },
    ],
  },
  {
    id: 's2', code: 'S2', name: 'Win and level up',
    desc: '5 GNOT in the wallet. Join a Quick table of 3, seal 22, reveal, settle, claim 2.985 GNOT, +34 points, rank up, flame +1.',
    seed(x) {
      conn(x, 5 * U)
      x.mock.seedPlayer(x.mock.wallet.address, { lifetime: 80 })
      x.mock.addRound({ start: x.mock.clock - 30, entries: [{ bot: 0, pick: 33, joined: true, revealAt: 15 }, { bot: 1, pick: 50, joined: true, revealAt: 25 }] })
      x.session.setPickRaw('22')
      x.session.bark('Two regulars are already at the Quick table. Grab the third stool.')
    },
    steps: [
      ST.open('Two regulars are seated. You make three.'), ST.lock(22), ST.waitR, ST.reveal, ST.waitS, ST.settle,
      { t: 'Read the result', h: 'Average 35, target 23.33. Your 22 sat closest.', target: 'chart' },
      { t: 'Claim 2.985 GNOT', h: 'Pot 3 GNOT minus the 0.5% fee (0.015 GNOT).', target: 'claim', done: D.claimed, act: A.claim },
      { t: 'See your rank and streak', h: '+34 points: 10 for revealing, 20 for the win, 4 streak bonus. Rank: Regular.', target: 'navRegular',
        done: (x) => x.session.ui.panel === 'regular', act: async (x) => x.session.openPanel('regular') },
    ],
  },
  {
    id: 's3', code: 'S3', name: 'Lose',
    desc: 'Same table, another regular wins. You still earn points. Barkeep line, then Play again.',
    seed(x) {
      conn(x, 5 * U)
      x.mock.seedPlayer(x.mock.wallet.address, { lifetime: 150, streak: 2, lastWeek: wk(x) - 1 })
      x.mock.addRound({ start: x.mock.clock - 30, entries: [{ bot: 0, pick: 30, joined: true, revealAt: 15 }, { bot: 1, pick: 18, joined: true, revealAt: 25 }] })
      x.session.setPickRaw('40')
      x.session.bark('Two regulars are at the Quick table.')
    },
    steps: [
      ST.open('Two regulars are seated.'), ST.lock(40), ST.waitR, ST.reveal, ST.waitS, ST.settle,
      { t: 'Read the result', h: 'Thistle sat closest with 18. You still earn 10 + your streak bonus.', target: 'chart' },
      { t: 'Play again', h: 'A fresh Quick table opens.', target: 'playAgain',
        done: (x) => x.session.snap.rounds.length > 1 && x.session.ui.roundId !== x.session.snap.rounds[0].id,
        act: async (x) => {
          const id = x.mock.addRound({ start: x.mock.clock - 10, entries: [{ bot: 2, pick: 38, joined: true, revealAt: 12 }, { bot: 3, pick: 27, joinAt: 15, revealAt: 30 }, { bot: 5, pick: 45, joinAt: 30, revealAt: 20 }] })
          await sync(x)
          x.session.openRound(id)
          x.session.bark('Fresh table, fresh crowd.')
        } },
    ],
  },
  {
    id: 's4', code: 'S4', name: 'Forgot to reveal',
    desc: 'You sealed 35 but the reveal window closes. Forfeit explanation, lost deposit, no points.',
    seed(x) {
      conn(x, 4 * U)
      const id = nextId(x)
      x.mock.addRound({ start: x.mock.clock - 180, entries: [{ bot: 0, pick: 30, joined: true, revealed: true }, { bot: 1, pick: 45, joined: true, revealAt: 20 }, meSeat(x, id, 35)] })
      x.session.openRound(id)
      x.session.bark('The reveal window is open. One minute left.')
    },
    steps: [
      { t: 'The reveal window is open', h: 'In this story you forget to reveal. Leave the Reveal button alone.', target: 'cd' },
      { t: 'The reveal window closes', h: 'Waiting step: the clock runs out.', wait: true, done: D.inSettle, act: (x) => skip(x, 'settle') },
      ST.settle,
      { t: 'Read the forfeit', h: 'Your 1 GNOT stayed in the pot. No points this round.', target: 'forfeit' },
    ],
  },
  {
    id: 's5', code: 'S5', name: 'Cancelled round',
    desc: 'Only one player reveals. The round is cancelled and everyone is refunded in full, no fee taken.',
    seed(x) {
      conn(x, 4 * U)
      const id = nextId(x)
      x.mock.addRound({ start: x.mock.clock - 100, entries: [{ bot: 2, pick: 25, joined: true, willReveal: false }, { bot: 3, pick: 60, joined: true, willReveal: false }, meSeat(x, id, 40)] })
      x.session.openRound(id)
      x.session.bark('Quiet night. Three seated, the commit window closes soon.')
    },
    steps: [
      ST.waitR, ST.reveal, ST.waitS, ST.settle,
      { t: 'Claim your 1 GNOT refund', h: 'Cancelled rounds refund everyone in full. No fee taken.', target: 'claim', done: D.claimed, act: A.claim },
    ],
  },
  {
    id: 's6', code: 'S6', name: 'Tie',
    desc: 'Two picks sit at the same distance. They split the prize and the remainder rule shows.',
    seed(x) {
      conn(x, 4 * U)
      x.mock.seedPlayer(x.mock.wallet.address, { streak: 1, lastWeek: wk(x) })
      const id = nextId(x)
      x.mock.addRound({ start: x.mock.clock - 130, entries: [meSeat(x, id, 20), { bot: 4, pick: 20, joined: true, revealAt: 3 }, { bot: 5, pick: 50, joined: true, revealAt: 30 }, { bot: 6, pick: 60, joined: true, revealAt: 45 }] })
      x.session.openRound(id)
      x.session.bark('Four at the table. The reveal window is open.')
    },
    steps: [
      ST.reveal, ST.waitS, ST.settle,
      { t: 'Read the split', h: 'You and Moss both picked 20, distance 5. Each gets 1.99 GNOT.', target: 'chart' },
      { t: 'Claim 1.99 GNOT', target: 'claim', done: D.claimed, act: A.claim },
    ],
  },
  {
    id: 's7', code: 'S7', name: 'Two-player table',
    desc: '"Best with 3 or more" label. The lower pick always wins, with the reason.',
    seed(x) {
      conn(x, 5 * U)
      x.mock.addRound({ start: x.mock.clock - 15, entries: [{ bot: 7, pick: 60, joined: true, revealAt: 10 }] })
      x.session.setPickRaw('30')
      x.session.bark('Wren is alone at the Quick table.')
    },
    steps: [
      ST.open('Look for the "Best with 3 or more" label.'), ST.lock(30), ST.waitR, ST.reveal, ST.waitS, ST.settle,
      { t: 'Why the lower pick wins', h: 'With two players the target is one third of the sum.', target: 'twoWhy' },
    ],
  },
  {
    id: 's8', code: 'S8', name: 'Streak at risk',
    desc: 'The week ends in 20 hours. Buy a freeze, jump a week twice (freezes used), then jump three weeks (reset, freezes used up).',
    seed(x) {
      x.mock.clock = Date.UTC(2026, 10, 29, 4, 0, 0) / 1000
      conn(x, 5 * U)
      x.mock.seedPlayer(x.mock.wallet.address, { lifetime: 340, spent: 220, streak: 3, lastWeek: wk(x) - 1, freezes: 1 })
      live(x)
      x.session.openPanel('regular')
      x.session.bark(LINES.risk(humanLong(weekEnd(x.mock.clock) - x.mock.clock)))
    },
    steps: [
      { t: 'Your streak is at risk', h: 'The week ends in 20 hours. The flame in the header turns red.', target: 'flame' },
      { t: 'Buy a streak freeze', h: '40 points. You can hold 2.', target: 'buyFreeze',
        done: (x) => (x.session.snap.player?.freezes ?? 0) >= 2, act: async (x) => confirm(x, x.session.requestFreeze()) },
      { t: 'Jump a week', h: 'You skip the week. A freeze covers it automatically.', target: 'jumpWeek', done: (x) => x.session.ui.jumps >= 1, act: (x) => A.jump(x, 1) },
      { t: 'Jump another week', h: 'The second freeze covers this one.', target: 'jumpWeek', done: (x) => x.session.ui.jumps >= 2, act: (x) => A.jump(x, 1) },
      { t: 'Buy one more freeze', h: 'You hold 0 now. Buy one so the next jump shows the reset rule.', target: 'buyFreeze',
        done: (x) => x.session.ui.jumps >= 2 && (x.session.snap.player?.freezes ?? 0) >= 1, act: async (x) => confirm(x, x.session.requestFreeze()) },
      { t: 'Jump three weeks', h: '3 missed weeks, 1 freeze held: the streak resets and the freeze is used up.', target: 'jump3',
        done: (x) => x.session.snap.player?.streak === 0, act: (x) => A.jump(x, 3) },
      { t: 'Read the warnings', h: 'Both cards warn about the reset rule.', target: 'streakCard' },
    ],
  },
  {
    id: 's9', code: 'S9', name: 'Shop and skins',
    desc: 'Buy and equip a starter hat, hit the Moonlit lock, buy Moonlit, then open a Moonlit table everyone sees.',
    seed(x) {
      conn(x, 5 * U)
      x.mock.seedPlayer(x.mock.wallet.address, { lifetime: 260, spent: 60, streak: 1, lastWeek: wk(x) })
      live(x)
      x.session.bark('200 points burning a hole in your apron.')
    },
    steps: [
      { t: 'Open the Shop', target: 'navShop', done: (x) => x.session.ui.panel === 'shop', act: async (x) => x.session.openPanel('shop') },
      { t: 'Buy the Feather band', h: 'A starter hat: 40 points.', target: 'buy_h1',
        done: (x) => !!x.session.snap.player?.owned.includes('h1'), act: async (x) => { x.session.setShopTab('hat'); await confirm(x, x.session.requestBuy('h1')) } },
      { t: 'Equip it', target: 'equip_h1', done: (x) => x.session.snap.player?.equipped.hat === 'h1', act: async (x) => confirm(x, x.session.requestEquip('h1', true)) },
      { t: 'Back to Tables', target: 'navTables', done: (x) => x.session.ui.view === 'room' && !x.session.ui.panel, act: async (x) => { x.session.closeTx(); x.session.backToRoom() } },
      { t: 'Create a table', target: 'create', done: (x) => x.session.ui.sheet === 'create', act: async (x) => x.session.openCreate() },
      { t: 'Pick the Moonlit table', h: "You don't own it yet: lock, price and a Shop link appear.", target: 'skin_moon',
        done: (x) => x.session.ui.create.skin === 1, act: async (x) => { x.session.openCreate(); x.session.setCreate({ skin: 1 }) } },
      { t: 'Get it in the Shop', target: 'shopLink', done: (x) => x.session.ui.panel === 'shop' && x.session.ui.shopTab === 'skin', act: async (x) => x.session.toShopSkins() },
      { t: 'Buy Moonlit', h: '150 points.', target: 'buy_moon', done: (x) => !!x.session.snap.player?.skins.includes(1), act: async (x) => confirm(x, x.session.requestSkin(1)) },
      { t: 'Open a table with Moonlit', h: 'Back to Create table, Moonlit is selected, press Open table.',
        target: (x) => (x.session.ui.sheet === 'create' ? 'createConfirm' : x.session.ui.panel === 'shop' ? 'backCreate' : 'create'),
        done: (x) => x.session.snap.rounds.some((r) => r.skin === 1),
        act: async (x) => { x.session.closeTx(); x.session.setCreate({ skin: 1 }); await confirm(x, x.session.requestCreate()) } },
      { t: 'Everyone at the table sees Moonlit', h: 'Regulars who sit here see the same skin.', target: 'skinNote' },
    ],
  },
  {
    id: 's10a', code: 'S10a', sub: true, name: 'Wallet: not installed', desc: 'Connect with no Adena: install link, check again, connect.',
    seed(x) { x.mock.wallet.installed = false; live(x) },
    steps: [
      { t: 'Press Connect wallet', target: 'connect', done: (x) => x.session.ui.sheet === 'connect', act: async (x) => x.session.openSheet('connect') },
      { t: 'Install Adena, then check again', h: '"Get Adena" opens adena.app. Here, "I installed it" fakes the install.', target: 'recheck',
        done: (x) => x.session.snap.wallet.installed, act: async (x) => { x.session.openSheet('connect'); x.mock.wallet.installed = true; await sync(x) } },
      { t: 'Approve the connection', target: 'connectOk', done: (x) => sel.connected(x.session.snap), act: (x) => x.session.connect() },
    ],
  },
  {
    id: 's10b', code: 'S10b', sub: true, name: 'Wallet: wrong network', desc: 'Adena is on test5. Join is blocked with the reason until you switch.',
    seed(x) { conn(x, 5 * U); x.mock.wallet.network = 'test5'; live(x); x.session.setPickRaw('30') },
    steps: [
      ST.open('The red banner already says what is wrong.'),
      { t: 'Joining is blocked', h: 'The reason sits next to the disabled button.', target: 'lock' },
      { t: 'Switch to onyx-1', target: 'switchNet', done: (x) => x.session.snap.wallet.network === NETWORK,
        act: async (x) => { x.mock.wallet.network = NETWORK; await sync(x); x.session.toast(`Adena switched to Testnet ${NETWORK}.`) } },
    ],
  },
  {
    id: 's10c', code: 'S10c', sub: true, name: 'Wallet: insufficient balance', desc: '0.4 GNOT in the wallet. Join shows the amount short and a faucet link.',
    seed(x) { conn(x, 400_000); live(x); x.session.setPickRaw('30') },
    steps: [
      ST.open(),
      { t: '0.6 GNOT short', h: 'The button says exactly how much is missing.', target: 'lock' },
      { t: 'Top up from the faucet', h: 'The link opens faucet.gno.land. Here, the button fakes it.', target: 'faucet',
        done: (x) => x.session.snap.wallet.balance >= U,
        act: async (x) => { x.mock.wallet.balance += 10 * U; await sync(x); x.session.toast('Faucet sent 10 GNOT (simulated).') } },
    ],
  },
  {
    id: 's10d', code: 'S10d', sub: true, name: 'Wallet: signature rejected', desc: 'You open the signature and press Reject. Nothing is sent.',
    seed(x) { conn(x, 5 * U); live(x); x.session.setPickRaw('30') },
    steps: [
      ST.open(),
      { t: 'Lock a pick', target: 'lock', done: (x) => !!x.session.ui.tx, act: async (x) => { x.session.requestJoin() } },
      { t: 'Reject the signature', target: 'reject', done: (x) => x.session.ui.lastTx === 'rejected',
        act: async (x) => { if (!x.session.ui.tx) x.session.requestJoin(); x.session.reject() } },
      { t: 'Nothing was sent', h: 'Close the sheet. Your seat is still open.', target: 'txClose' },
    ],
  },
  {
    id: 's10e', code: 'S10e', sub: true, name: 'Wallet: transaction failed', desc: 'You approve, the chain rejects it with a reason, you try again.',
    seed(x) { conn(x, 5 * U); x.mock.failNext = 'the commit window closed before the transaction was included in a block.'; live(x); x.session.setPickRaw('30') },
    steps: [
      ST.open(),
      { t: 'Lock a pick', target: 'lock', done: (x) => !!x.session.ui.tx, act: async (x) => { x.session.requestJoin() } },
      { t: 'Approve and watch it fail', target: 'approve', done: (x) => x.session.ui.lastTx === 'failed',
        act: async (x) => { if (!x.session.ui.tx) x.session.requestJoin(); await x.session.approve() } },
      { t: 'Read the reason, then try again', target: 'txRetry', done: D.joined, act: async (x) => { x.session.retryTx(); await x.session.approve() } },
    ],
  },
  {
    id: 's10f', code: 'S10f', sub: true, name: 'Wallet: RPC unreachable', desc: 'The testnet RPC does not answer. Banner with Retry.',
    seed(x) { conn(x, 5 * U); live(x); x.mock.rpcUp = false },
    steps: [
      { t: 'The network is unreachable', h: 'Actions that need the chain are disabled with the reason.', target: 'rpcBanner' },
      { t: 'Retry', target: 'retry', done: (x) => x.session.snap.rpcOk, act: (x) => x.session.retry() },
    ],
  },
  {
    id: 's11', code: 'S11', name: 'Judge view', desc: 'A seeded Quick table cycles live at 10x. Watch as a visitor, then join and play.',
    seed(x) {
      x.session.setDev({ speed: 10 })
      conn(x, 5 * U)
      const id = x.mock.spawnJudge(x.mock.clock - 5)
      x.session.openRound(id)
      x.session.setPickRaw('30')
      x.session.bark('A live table. Watch one round, then take a seat.')
    },
    steps: [
      { t: 'Watch as a visitor', h: 'Time runs at 10x. Regulars join, seal and reveal on their own.', target: 'spectator' },
      { t: 'Wait for the reveal', wait: true, done: D.inReveal, act: (x) => skip(x, 'reveal') },
      { t: 'Wait for the result', h: 'A regular presses Settle.', wait: true, done: D.settled, act: A.judgeSettle },
      { t: 'Join the next round', h: 'A new table opens a moment after the result. Lock any number.', target: 'lock',
        done: (x) => { const r = cur(x); return !!r && !r.settled && !!me(x) },
        act: async (x) => {
          x.session.closeTx()
          const r = cur(x)
          if (r?.settled) {
            const n = r.nextId ?? x.mock.spawnJudge()
            x.mock.rounds[r.id].next = n
            await sync(x)
            x.session.openRound(n)
          }
          await confirm(x, x.session.requestJoin())
        } },
      ST.waitR, ST.reveal,
      { t: 'Wait for the result', wait: true, done: D.settled, act: A.judgeSettle },
      { t: 'Read your result', target: 'chart' },
    ],
  },
  {
    id: 's12', code: 'S12', name: 'Fee transparency', desc: 'The join screen with pot, fee and winner net at 2, 5 and 10 players, then the same numbers in Adena.',
    seed(x) {
      conn(x, 5 * U)
      x.mock.addRound({ start: x.mock.clock - 20, entries: [{ bot: 0, pick: 40, joined: true }, { bot: 1, pick: 28, joined: true }] })
      x.session.setPickRaw('26')
      x.session.bark(LINES.fee)
    },
    steps: [
      ST.open('The breakdown sits beside your pick.'),
      { t: 'Compare 2, 5 and 10 players', h: '0.5% of the pot, only when 2 or more reveal.', target: 'feeTable' },
      { t: 'Lock a pick', h: 'Adena shows the same numbers before you sign.', target: 'lock',
        done: (x) => !!x.session.ui.tx || D.joined(x), act: async (x) => { x.session.requestJoin() } },
      { t: 'Approve the signature', target: 'approve', done: D.joined, act: async (x) => { if (!x.session.ui.tx) x.session.requestJoin(); await x.session.approve() } },
    ],
  },
  {
    id: 's13', code: 'S13', name: 'Owner view', desc: 'Connected as the fee recipient: a Withdraw fees panel appears. Other users never see it.',
    seed(x) {
      conn(x, 8 * U)
      x.mock.wallet.address = OWNER_ADDR
      x.mock.fees = 105_000
      x.mock.seedPlayer(OWNER_ADDR, { lifetime: 620, spent: 300, streak: 4, lastWeek: wk(x) })
      live(x)
      x.session.bark(LINES.fee)
    },
    steps: [
      { t: 'Open My Regular', h: 'You are connected as the fee recipient.', target: 'navRegular', done: (x) => x.session.ui.panel === 'regular', act: async (x) => x.session.openPanel('regular') },
      { t: 'Withdraw the fees', h: '0.105 GNOT from 7 completed rounds goes to the treasury address.', target: 'withdraw',
        done: (x) => x.session.snap.fees === 0, act: async (x) => confirm(x, x.session.requestWithdraw()) },
      { t: 'Only the owner sees this', h: 'Load S2 and open My Regular: the panel is not there.' },
    ],
  },
]

export const SCENARIO: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]))

/** Fresh mock chain + session seeded with a scenario. */
export async function loadScenario(id: string, salts: SaltStore = new MemorySaltStore()): Promise<Ctx> {
  const mock = new MockChain()
  const session = new Session({ chain: mock, mock, salts })
  const x = { session, mock }
  await SCENARIO[id].seed(x)
  await session.refresh()
  return x
}

/** Runs every step in guided order, performing it when not already done. Returns the failed step index or -1. */
export async function runScenario(x: Ctx, sc: Scenario): Promise<number> {
  for (let i = 0; i < sc.steps.length; i++) {
    const st = sc.steps[i]
    if (st.done && !st.done(x) && st.act) {
      await st.act(x)
      await x.session.refresh()
    }
    if (st.done && !st.done(x)) return i
  }
  return -1
}
