import { BARKEEP_ADDR, BARKEEP_LOOK } from '../game/constants'
import { places } from '../game/room'
import { Gnome } from '../scene/Gnome'
import { runPlace } from '../state/places'
import { useSession } from '../state/useSession'

/** The Barkeep's dialog box: portrait plus the current line. */
export function DialogBox() {
  const [{ ui }] = useSession()
  return (
    <div className="dialog-box" role="status">
      <span className="portrait"><Gnome addr={BARKEEP_ADDR} look={BARKEEP_LOOK} size={56} /></span>
      <div className="dialog-box-text">
        <p className="h" style={{ color: 'var(--amber)', fontSize: '0.9375rem' }}>Barkeep</p>
        <p>{ui.bark || 'Pull up a stool.'}</p>
      </div>
    </div>
  )
}

/** Same destinations as the room hotspots, as a row of buttons. */
export function PlacesRow() {
  const [{ snap, ui }, session] = useSession()
  return (
    <nav aria-label="Places in the taproom" className="places">
      {places(snap, ui.roundId).map((p) => (
        <button key={p.id} type="button" className="pb sm" aria-label={p.aria} onClick={() => runPlace(session, p.action)}>{p.label}</button>
      ))}
    </nav>
  )
}

export function Toasts() {
  const [{ ui }] = useSession()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {ui.toasts.map((t) => <div key={t.id} className="win a-drop toast">{t.text}</div>)}
    </div>
  )
}
