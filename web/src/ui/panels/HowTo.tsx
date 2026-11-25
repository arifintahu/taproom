import { useId } from 'react'
import { practiceResult } from '../../game/practice'
import { practiceSeat, practiceStatus } from '../../game/panels'
import { chalk } from '../../game/closeup'
import { pickOk } from '../../game/rules'
import { connected } from '../../game/selectors'
import { BOTS } from '../../chain/mock/bots'
import { Gnome } from '../../scene/Gnome'
import { useSession } from '../../state/useSession'
import { Slate } from '../Slate'

const RULES = [
  ['1 · Seal', 'Pay 1 GNOT and seal a number from 0 to 100. Only a hash goes on chain.'],
  ['2 · Reveal', 'Break your seal before the hourglass runs out, or your deposit stays in the pot.'],
  ['3 · Settle', 'Anyone settles. Closest to 2/3 of the average wins; ties split; 0.5% fee on completed pots.'],
  ['4 · Claim', 'Winners claim. Fewer than 2 reveals cancels the round and refunds everyone.'],
]

/** The Barkeep's practice round: no chain, five scripted regulars, about 20 seconds. */
function Practice() {
  const [{ snap, ui }, session] = useSession()
  const id = useId()
  const p = ui.practice
  const ok = pickOk(p.pickRaw)
  const el = ui.wall - p.t0
  const running = p.phase === 'sealed' || p.phase === 'reveal'
  const pick = ok ? Number(p.pickRaw) : 0
  const rr = practiceResult(pick)
  const me = snap.wallet.address || 'guest'
  const looks = [snap.player?.equipped ?? {}, ...BOTS.slice(0, 5).map((b) => b.look)]
  return (
    <section className="card stack" aria-label="Practice game">
      <div className="row-between wrap">
        <h3 className="h big-text">The Barkeep's practice game</h3>
        <span className="chip">No chain, no coins</span>
      </div>
      {p.phase === 'idle' && (
        <>
          <p>One round against 5 scripted regulars, about 20 seconds.</p>
          <button type="button" className="pb pp" data-tg="practice" onClick={() => session.practiceStart()}>Start practice</button>
        </>
      )}
      {p.phase === 'pick' && (
        <>
          <p>Guess the crowd. Closest to 2/3 of the average wins.</p>
          <div className="picker">
            <label htmlFor={id} className="picker-label mu">Number
              <input id={id} className="num" type="number" inputMode="numeric" min={0} max={100} step={1} value={p.pickRaw}
                aria-invalid={!ok} onChange={(e) => session.practiceSetPick(e.target.value)} />
            </label>
            <input type="range" min={0} max={100} step={1} value={pick} aria-label="Practice number" className="slider"
              onChange={(e) => session.practiceSetPick(e.target.value)} />
          </div>
          {!ok && <p role="alert" className="bad">Enter a whole number from 0 to 100.</p>}
          <button type="button" className="pb pp" data-tg="pracLock" disabled={!ok} onClick={() => session.practiceLock()}>Seal my practice slip</button>
        </>
      )}
      {running && (
        <>
          <p role="status" className="h">{practiceStatus(p.phase as 'sealed' | 'reveal', el)}</p>
          <ul aria-label="Practice seats" className="practice-seats">
            {rr.list.map((x, i) => {
              const st = practiceSeat(i, el)
              return (
                <li key={x.addr}>
                  <Gnome addr={i === 0 ? me : x.addr} look={looks[i]} size={48} />
                  <span className="h small">{x.name}</span>
                  <span className={`slip-chip ${st.revealed ? 'open' : st.sealed ? 'sealed' : 'thinking'}${st.justFlipped ? ' a-flip' : ''}`}>
                    {st.revealed ? x.pick : st.sealed ? 'Sealed' : 'Thinking'}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {p.phase === 'result' && (
        <>
          <Slate title="Practice tally" chalk={chalk(rr.list.map((x) => ({ ...x, revealed: true })), rr.winners, rr.avg, rr.target)} />
          <div className="row-wrap">
            <button type="button" className="pb pp" data-tg="pracDone" onClick={() => session.showConnectPrompt()}>Continue</button>
            <button type="button" className="pb" onClick={() => session.practiceStart()}>Practice again</button>
          </div>
        </>
      )}
      {ui.connectPrompt && !connected(snap) && (
        <div className="prompt stack-sm">
          <p className="h">Ready to play for the pot?</p>
          <p>Sign the guest ledger with Adena on {snap.networkLabel}. You'll see every amount before you sign.</p>
          <button type="button" className="pb pp" data-tg="connect" style={{ alignSelf: 'flex-start' }} onClick={() => session.openSheet('connect')}>Connect wallet</button>
        </div>
      )}
    </section>
  )
}

export function HowToPanel() {
  return (
    <div className="stack wide-stack">
      <ol className="rules">
        {RULES.map(([t, d]) => (
          <li key={t} className="card"><p className="h" style={{ color: 'var(--amber)' }}>{t}</p><p>{d}</p></li>
        ))}
      </ol>
      <Practice />
    </div>
  )
}
