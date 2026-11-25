import { hearthState } from '../../game/room'
import { streakView } from '../../game/panels'
import { connected } from '../../game/selectors'
import { recent } from '../../scene/useScale'
import { useSession } from '../../state/useSession'

type StreakV = ReturnType<typeof streakView>

export function StreakCard({ v }: { v: StreakV }) {
  return (
    <section className="card stack-sm" aria-label="Weekly streak">
      <h3 className="h">{v.title}</h3>
      <p className="mu">{v.line}</p>
      <p>Week ends in {v.weekLeft} (Monday 00:00 UTC)</p>
      {v.atRisk && <p className="bad">At risk: {v.riskLine}</p>}
      {v.broken && <p className="bad">Streak reset. Your next revealed round starts week 1.</p>}
      <p className="warn small">Miss more weeks than the freezes you hold and the streak resets to 1, and every held freeze is used up.</p>
    </section>
  )
}

export function FreezeCard({ v, primary }: { v: StreakV; primary?: boolean }) {
  const [, session] = useSession()
  return (
    <section className="card stack-sm" aria-label="Streak freezes">
      <h3 className="h">Ember jars (freezes): {v.freezes} of 2</h3>
      <p className="mu">Each covers one missed week, used automatically. 40 points each.</p>
      <button type="button" className={`pb${primary ? ' pp' : ''}`} style={{ alignSelf: 'flex-start' }} disabled={!!v.freezeReason} onClick={() => session.requestFreeze()}>
        Buy an ember jar · 40 pts
      </button>
      {v.freezeReason && <p className="mu small">{v.freezeReason}</p>}
    </section>
  )
}

/** The hearth: fire, streak, risk and reset warnings, bonus ladder, ember jars. */
export function HearthPanel() {
  const [{ snap, ui }] = useSession()
  const v = streakView(snap)
  const h = hearthState(snap)
  const grow = recent(ui.anim, ui.wall, 'flame', 1600) ? ' a-grow' : ''
  return (
    <div className="stack wide-stack">
      <div className="regular-top">
        <div className={`fire${h === 'low' ? ' fire-low' : ''}${h === 'cold' ? ' fire-cold' : ''}${grow}`} style={{ width: 96, height: 84, flex: 'none' }} aria-hidden="true" />
        <div className="grow">
          <p className="h big-text">{v.title}</p>
          <p className="mu">{v.line}</p>
          <p>Week ends in {v.weekLeft} (Monday 00:00 UTC)</p>
        </div>
      </div>
      {!connected(snap) && <p>Connect a wallet to keep a fire going.</p>}
      <section className="card stack-sm">
        {v.atRisk && <p className="bad">At risk: {v.riskLine}</p>}
        {v.broken && <p className="bad">The fire went cold. Your next revealed round starts week 1.</p>}
        <p>Bonus per revealed round: 4 points × streak weeks, up to 20 (4, 8, 12, 16, 20).</p>
        <p className="warn small">Miss more weeks than the ember jars you hold and the streak resets to 1, and every jar is used up.</p>
      </section>
      {connected(snap) && <FreezeCard v={v} primary />}
    </div>
  )
}
