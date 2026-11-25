import { gallery, hallBoard, HALL_TABS, type HallTab } from '../../game/panels'
import { Gnome } from '../../scene/Gnome'
import { useSession } from '../../state/useSession'
import { Tabs } from '../Tabs'

const TABS = (Object.keys(HALL_TABS) as HallTab[]).map((k) => [k, HALL_TABS[k].title] as [HallTab, string])

/** The Hall: four leaderboards and the gallery sorted by style score. */
export function HallPanel() {
  const [{ snap, ui }, session] = useSession()
  const tab = ui.hallTab
  const rows = hallBoard(snap, tab)
  return (
    <div className="stack wide-stack">
      <Tabs label="Leaderboards" tabs={TABS} value={tab} onChange={(t) => session.setHallTab(t)}>
        {rows.length === 0 ? <p className="mu">The Hall is quiet. Leaderboards fill after the first settled rounds.</p> : (
          <table className="grid-table hall-table">
            <caption className="sr">{HALL_TABS[tab].title}</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Regular</th><th scope="col">{HALL_TABS[tab].col}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.addr} className={r.me ? 'me' : ''}>
                  <td className="h">{r.rank}</td>
                  <th scope="row"><span className="hall-name"><Gnome addr={r.addr} look={r.look} size={48} />{r.name}</span></th>
                  <td>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tabs>
      <h3 className="h big-text">Gallery</h3>
      <p className="mu small">Sorted by style score: Common 1, Rare 3, Epic 6, Legendary 10.</p>
      <ul className="gallery">
        {gallery(snap).map((g) => (
          <li key={g.addr} className="card gallery-card">
            <Gnome addr={g.addr} look={g.look} size={96} />
            <span className="h">{g.name}</span>
            <span className="chip" style={{ color: 'var(--amber)' }}>Style {g.score}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
