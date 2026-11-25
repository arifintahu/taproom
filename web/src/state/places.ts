import type { PlaceAction } from '../game/room'
import type { Session } from './session'

/** Runs a room hotspot or Places-row destination. */
export function runPlace(session: Session, a: PlaceAction) {
  if (a.kind === 'ledger') session.ledger()
  else if (a.kind === 'panel') session.openPanel(a.panel)
  else if (a.kind === 'round') session.openRound(a.id)
  else session.openCreate()
}
