import { fmtG, human, humanLong } from '../game/format'
import { spendable, streakState } from '../game/rules'
import { connected } from '../game/selectors'
import { useSession } from '../state/useSession'
import { HOSTED_REAL } from '../state/welcome'

/** Status bar: title, coin pouch, network, streak flame, points, New table, Settings, How to play. */
export function Hud() {
  const [{ snap, ui }, session] = useSession()
  const on = connected(snap)
  const w = snap.wallet
  const p = snap.player
  const st = p ? streakState(p, snap.now) : null
  const netBad = !snap.rpcOk || (on && w.network !== snap.network)
  const netLabel = !snap.rpcOk ? `${snap.networkLabel} · offline` : on && w.network !== snap.network ? `Wrong network: ${w.network}` : snap.networkLabel
  const sp = p ? spendable(p) : 0
  const flameGrow = ui.anim.flame && ui.wall - ui.anim.flame < 1600 ? ' a-grow' : ''

  return (
    <header className="hud" aria-label="Status">
      {ui.view === 'table' && <button type="button" className="pb sm" data-tg="navTables" onClick={() => session.backToRoom()}>← Taproom</button>}
      <span className="h hud-title">Taproom</span>
      <button type="button" className="pb sm" data-tg="connect" onClick={() => session.ledger()}
        aria-label={on ? `Wallet ${w.address}, ${fmtG(w.balance)} GNOT` : 'Connect wallet'}>
        <span className="ic ic-pouch" aria-hidden="true" />
        <span>{on ? `${fmtG(w.balance)} GNOT` : 'Connect wallet'}</span>
      </button>
      <span className="chip" style={{ color: netBad ? 'var(--red)' : 'var(--teal)' }}>{netLabel}</span>
      <span className="hud-gap" />
      {on && p && st && (
        <>
          <button type="button" className="pb sm" data-tg="flame" onClick={() => session.openPanel('hearth')}
            style={{ color: st.atRisk ? 'var(--red)' : 'var(--amber)' }}
            aria-label={`Streak ${p.streak} weeks. Week ends in ${humanLong(st.weekLeft)}.${st.atRisk ? ' At risk.' : ''}`}>
            <span className={`ic ic-flame${flameGrow}`} aria-hidden="true" />
            <span style={{ color: 'var(--ink)' }}>{p.streak} wk · {human(st.weekLeft)}</span>
            {st.atRisk && <span className="sr">At risk</span>}
          </button>
          <button type="button" className="pb sm" onClick={() => session.openPanel('shop')} aria-label={`${sp} spendable points. Open the shop.`}>
            <span className="ic ic-points" aria-hidden="true" />
            <span>{sp} pts</span>
          </button>
        </>
      )}
      <button type="button" className="pb sm" data-tg="create" onClick={() => session.openCreate()}>+ New table</button>
      <button type="button" className="pb sm" onClick={() => session.ledger()} aria-label="Settings"><span className="ic ic-gear" aria-hidden="true" /></button>
      <button type="button" className="pb sm" onClick={() => session.openPanel('howto')} aria-label="How to play"><span className="ic ic-book" aria-hidden="true" /></button>
    </header>
  )
}

/** Banners: practice mode on the hosted site, then red ones for an unreachable RPC or the wrong Adena network. */
export function Banners() {
  const [{ snap }, session] = useSession()
  const wrongNet = connected(snap) && snap.rpcOk && snap.wallet.network !== snap.network
  const practice = HOSTED_REAL && !!session.mock && !new URLSearchParams(location.search).has('dev')
  return (
    <>
      {practice && (
        <div role="note" className="banner practice" data-tg="practiceBanner">
          <p><strong>Practice table.</strong> The chain, wallet and regulars are simulated. Nothing here is on the testnet.</p>
          <a className="pb sm" href="/">Play on the testnet</a>
        </div>
      )}
      {!snap.rpcOk && (
        <div role="alert" className="banner" data-tg="rpcBanner">
          <p><strong>Can't reach the {snap.networkLabel} node.</strong> Nothing you sign is sent until it's back.</p>
          <button type="button" className="pb sm" data-tg="retry" onClick={() => void session.retry()}>Retry</button>
        </div>
      )}
      {wrongNet && (
        <div role="alert" className="banner">
          <p><strong>Adena is on {snap.wallet.network}.</strong> Taproom runs on {snap.networkLabel}.</p>
          {session.canSwitchNetwork && <button type="button" className="pb sm" data-tg="switchNet" onClick={() => void session.switchNetwork()}>Switch to {snap.network}</button>}
        </div>
      )}
    </>
  )
}
