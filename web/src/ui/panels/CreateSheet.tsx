import { useId } from 'react'
import { PRESET_IDS, PRESETS } from '../../game/constants'
import { createView } from '../../game/panels'
import { useSession } from '../../state/useSession'
import { Window } from '../Window'

/** New table: hourglass preset, table skin (locked ones show the price and a Shop link), Open table. */
export function CreateSheet() {
  const [{ snap, ui }, session] = useSession()
  const v = createView(snap, ui.create.skin)
  const name = useId()
  return (
    <Window title="Open a new table" onClose={() => session.closeSheet()}>
      <div className="stack">
        <fieldset className="fieldset">
          <legend className="h">Hourglass</legend>
          {PRESET_IDS.map((id) => (
            <label key={id} className={`choice${ui.create.preset === id ? ' on' : ''}`}>
              <input type="radio" name={name} checked={ui.create.preset === id} onChange={() => session.setCreate({ preset: id })} />
              <span><strong>{PRESETS[id].label}</strong> <span className="mu">{PRESETS[id].desc}{id === 'quick' ? ' · default' : ''}</span></span>
            </label>
          ))}
        </fieldset>
        <fieldset className="fieldset">
          <legend className="h">Table</legend>
          {v.skins.map((k) => (
            <button key={k.id} type="button" className="pb skin-choice" aria-pressed={ui.create.skin === k.id}
              onClick={() => session.setCreate({ skin: k.id })}>
              <img src={`/pixel/scene/table_room_${k.key}.svg`} alt="" className="skin-thumb" />
              <span className="grow left">{k.name}</span>
              <span className="small">{k.locked ? `Locked · ${k.tag}` : k.tag}</span>
            </button>
          ))}
        </fieldset>
        {v.locked && (
          <div role="alert" className="lock-box">
            <span className="grow">{v.lockReason}</span>
            <button type="button" className="pb sm" onClick={() => session.toShopSkins()}>Get it from the tailor</button>
          </div>
        )}
        <p className="mu small">Target fixed at 2/3 of the average. 1 GNOT per seat, up to 10 seats. Opening a table costs no coins.</p>
        <button type="button" className="pb pp" disabled={!!v.reason} onClick={() => session.requestCreate()}>Open table</button>
        {v.showReason && <p className="mu small">{v.reason}</p>}
        <button type="button" className="pb" onClick={() => session.closeSheet()}>Cancel</button>
      </div>
    </Window>
  )
}
