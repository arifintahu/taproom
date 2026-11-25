import { roundView } from '../game/closeup'
import { TableCloseup } from '../scene/TableCloseup'
import { useSession } from '../state/useSession'
import { DialogBox } from './DialogBox'
import { Breakdown, Result, RoundHeader, YourMove } from './RoundPanels'

/** Table screen: header, close-up, then Your move beside the breakdown (before joining) or the result. */
export function TableView() {
  const [{ snap }, session] = useSession()
  const r = session.currentRound()
  if (!r) {
    return (
      <div className="win table-placeholder">
        <p className="h">This table has gone quiet.</p>
        <button type="button" className="pb pp" onClick={() => session.backToRoom()}>Back to the taproom</button>
      </div>
    )
  }
  const v = roundView(snap, r)
  return (
    <>
      <RoundHeader v={v} />
      <TableCloseup round={r} />
      <DialogBox />
      <div className="round-grid">
        <YourMove round={r} v={v} />
        <div className="round-side">
          {v.state === 'visitor-pick' && <Breakdown v={v} />}
          <Result v={v} />
        </div>
      </div>
    </>
  )
}
