import { useId } from 'react'
import type { RoundView } from '../game/closeup'
import { joinBlock, realmBlock } from '../game/selectors'
import { pickOk } from '../game/rules'
import type { Round } from '../game/types'
import { useSession } from '../state/useSession'
import { Slate } from './Slate'

/** Title strip above the close-up: name, phase steps, seats, "Best with 3 or more". */
export function RoundHeader({ v }: { v: RoundView }) {
  return (
    <div className="round-head">
      <h1 className="h round-title">{v.title}</h1>
      <ol aria-label="Round phases" className="phases">
        {v.steps.map((p) => (
          <li key={p.label} aria-current={p.current ? 'step' : undefined}
            className={`chip${p.current && !p.done ? ' phase-now' : p.done ? ' phase-done' : ' phase-later'}`}>
            {p.done ? '✓ ' : ''}{p.label}
          </li>
        ))}
      </ol>
      <span className="chip" style={{ color: 'var(--mu)' }}>{v.seatsText}</span>
      {v.bestWithThree && <span className="chip" style={{ color: 'var(--chalk)' }}>Best with 3 or more</span>}
    </div>
  )
}

function PickInput() {
  const [{ ui }, session] = useSession()
  const id = useId()
  const ok = pickOk(ui.pickRaw)
  return (
    <>
      <div className="picker">
        <button type="button" className="pb" onClick={() => session.stepPick(-1)} aria-label="Lower by one">−</button>
        <label htmlFor={id} className="picker-label mu">Number
          <input id={id} className="num" type="number" inputMode="numeric" min={0} max={100} step={1}
            value={ui.pickRaw} aria-invalid={!ok} onChange={(e) => session.setPickRaw(e.target.value)} />
        </label>
        <button type="button" className="pb" onClick={() => session.stepPick(1)} aria-label="Raise by one">+</button>
        <input type="range" min={0} max={100} step={1} value={ok ? Number(ui.pickRaw) : 0}
          onChange={(e) => session.setPickRaw(e.target.value)} aria-label="Your number" className="slider" />
      </div>
      {!ok && <p role="alert" className="bad">Enter a whole number from 0 to 100.</p>}
    </>
  )
}

/** "Your move": countdown, picker and Seal, Reveal, Settle, the outcome and Claim. */
export function YourMove({ round: r, v }: { round: Round; v: RoundView }) {
  const [{ snap, ui }, session] = useSession()
  const rb = realmBlock(snap)
  const jb = joinBlock(snap, r)
  const me = snap.wallet.connected ? r.entries.find((e) => e.addr === snap.wallet.address) : undefined
  // Before reveal only this device knows the pick, from the saved salt record.
  const sealedPick = me?.pick ?? session.salts.get(snap.realm, r.id, snap.wallet.address)?.pick
  const needsRealm = v.state === 'reveal-now' || v.state === 'settle-now' || v.claimable

  return (
    <section className="win move" aria-label="Your move">
      {v.showCountdown && (
        <div className="countdown">
          <img src={`/pixel/props/hourglass_${v.phase === 'commit' ? 'full' : 'half'}.svg`} alt="" className="countdown-glass" />
          <div>
            <p className="mu small">{v.countdownLabel}</p>
            <p className="h countdown-num" aria-hidden="true">{v.countdown}</p>
          </div>
        </div>
      )}
      <p className="sr" aria-live="polite">{v.live}</p>
      {v.spectator && <p>{v.spectator}</p>}

      {v.state === 'visitor-pick' && (
        <>
          <h2 className="h move-title">Write your number on the slip</h2>
          <p className="mu">Closest to 2/3 of the average of the revealed picks wins.</p>
          <PickInput />
          <button type="button" className="pb pp" disabled={!!jb || !pickOk(ui.pickRaw)} onClick={() => session.requestJoin()}>
            Seal my pick · pay 1 GNOT
          </button>
          {jb && <p className="bad">{jb}</p>}
          {v.phase === 'commit' && snap.wallet.connected && snap.wallet.balance < 1_000_000 && (
            <div className="row-wrap">
              <a href="https://faucet.gno.land" target="_blank" rel="noreferrer">Get test GNOT at faucet.gno.land</a>
              {session.mock && <button type="button" className="pb sm" onClick={() => void session.faucet()}>Simulate faucet +10 GNOT</button>}
            </div>
          )}
        </>
      )}
      {v.state === 'sealed' && (
        <>
          <h2 className="h move-title">Your slip is sealed{sealedPick != null ? `: ${sealedPick}` : ''}</h2>
          <p className="mu">Only a hash is on chain. Come back when the hourglass turns.</p>
        </>
      )}
      {v.state === 'reveal-now' && (
        <>
          <h2 className="h move-title">Break your seal</h2>
          <p>Reveal your {sealedPick ?? 'pick'} before the sand runs out, or your 1 GNOT stays in the pot.</p>
          <button type="button" className="pb pp" disabled={!!rb} onClick={() => session.requestReveal()}>Reveal my pick</button>
        </>
      )}
      {v.state === 'revealed-wait' && <p className="good">Revealed {me?.pick}. Waiting for the others.</p>}
      {v.state === 'visitor-wait' && <p className="mu">Regulars are breaking their seals. The result comes after someone settles.</p>}
      {v.state === 'settle-now' && (
        <>
          <h2 className="h move-title">The sand has run out</h2>
          <p className="mu">Anyone can settle, visitors too. Settling pays the pot and takes the 0.5% fee when 2 or more revealed.</p>
          <button type="button" className="pb pp" disabled={!!rb} onClick={() => session.requestSettle()}>Settle the round</button>
        </>
      )}
      {v.state === 'done' && (
        <>
          {v.outcome === 'win' && <h2 className="h move-title" style={{ color: 'var(--amber)', fontSize: '1.5rem' }}>You won {v.myPay} GNOT</h2>}
          {v.outcome === 'lose' && (
            <>
              <h2 className="h move-title">{v.winnerName} took the pot</h2>
              <p className="mu">Revealing still earned you points.</p>
            </>
          )}
          {v.outcome === 'forfeit' && (
            <div className="stack-sm">
              <h2 className="h move-title" style={{ color: 'var(--red)' }}>You didn't break your seal</h2>
              <p>The reveal window closed before you revealed, so your pick can't count. Your 1 GNOT stayed in the pot and went to the winner. No points this round.</p>
              <div className="row"><span>Deposit lost</span><span>−1 GNOT</span></div>
            </div>
          )}
          {v.outcome === 'refund' && (
            <>
              <h2 className="h move-title">Round cancelled</h2>
              <p>Fewer than 2 revealed. Everyone is refunded in full, no fee taken.</p>
            </>
          )}
          {v.outcome === 'visitor' && <p className="mu">You watched this one from the bar.</p>}
          {v.claimable && (
            <button type="button" className="pb pp" disabled={!!rb} onClick={() => session.requestClaim()}>
              <span className="ic ic-pouch" aria-hidden="true" />{v.claimLabel}
            </button>
          )}
          {v.claimed && <p className="good">Claimed {v.myPay} GNOT to your pouch.</p>}
          {v.points > 0 && <p className="h">+{v.points} points <span className="mu" style={{ fontWeight: 400 }}>({v.pointsBreak})</span></p>}
          <button type="button" className={`pb${v.claimable ? '' : ' pp'}`} onClick={() => session.playAgain()}>Play again</button>
        </>
      )}
      {needsRealm && rb && <p className="bad">{rb}</p>}
    </section>
  )
}

/** "Where the coins go": shown before you join. */
export function Breakdown({ v }: { v: RoundView }) {
  return (
    <section className="win stack-sm" aria-label="Money breakdown">
      <h2 className="h panel-title">Where the coins go</h2>
      <div>
        <div className="row"><span>Entry per player</span><span>1 GNOT</span></div>
        <div className="row"><span>Pot if you join ({v.join.players})</span><span>{v.join.pot} GNOT</span></div>
        <div className="row"><span>Tavern fee 0.5%, completed rounds</span><span>{v.join.fee} GNOT</span></div>
        <div className="row"><span>Winner receives</span><span>{v.join.net} GNOT</span></div>
      </div>
      <table className="grid-table">
        <caption className="sr">Pot, fee and winner's amount at 2, 5 and 10 players</caption>
        <thead><tr><th scope="col">Players</th><th scope="col">Pot</th><th scope="col">Fee</th><th scope="col">Winner</th></tr></thead>
        <tbody>{v.feeTable.map((f) => <tr key={f.n}><td>{f.n}</td><td>{f.pot}</td><td>{f.fee}</td><td>{f.net}</td></tr>)}</tbody>
      </table>
      <p className="mu small">Fewer than 2 reveals: full refunds, no fee.</p>
    </section>
  )
}

/** After Settle: chalk slate, pot summary, tie and two-player notes, or the cancelled box. */
export function Result({ v }: { v: RoundView }) {
  const res = v.result
  if (!res) return null
  if (res.cancelHead) {
    return (
      <section className="win stack-sm" aria-label="Refunds">
        <p className="h">{res.cancelHead}</p>
        <div className="row"><span>Refund per player</span><span>1 GNOT</span></div>
        <div className="row"><span>Tavern fee</span><span>0, no fee taken</span></div>
      </section>
    )
  }
  return (
    <>
      {res.chalk && <Slate title="Chalk tally" chalk={res.chalk} />}
      <section className="win stack-sm" aria-label="Pot summary">
        <div className="row"><span>Pot</span><span>{res.pot} GNOT</span></div>
        <div className="row"><span>Tavern fee (0.5%)</span><span>{res.fee} GNOT</span></div>
        <div className="row"><span>Prize</span><span>{res.prize} GNOT</span></div>
        {res.tie && (
          <p><strong>Tie.</strong> The prize splits: {res.tie.share} GNOT each. Any remainder goes to the first winner in join order (here {res.tie.remainder}).</p>
        )}
        {res.twoWhy && (
          <div className="two-why">
            <p className="h">Why the lower pick wins with two</p>
            <p>{res.twoWhy}</p>
          </div>
        )}
      </section>
    </>
  )
}
