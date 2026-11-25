import { useEffect, type CSSProperties } from 'react'
import { BARKEEP_ADDR, BARKEEP_LOOK } from '../game/constants'
import { hearthState, hotspots, roomScale, ROOM_H, ROOM_W, TABLE_SLOTS, tableSlots, type Rect } from '../game/room'
import { useSession } from '../state/useSession'
import { runPlace } from '../state/places'
import { Gnome } from './Gnome'
import { useScale } from './useScale'

const PX = '/pixel'
/** Guided-mode target keys for the room hotspots (see dev/scenarios.ts). */
const HOTSPOT_TG: Record<string, string> = {
  ledger: 'connect', stairs: 'navRegular', board: 'navHall', 'table-0': 'openTable',
  hearth: 'flame', barkeep: 'practice', wardrobe: 'navShop',
}
/** Deterministic pseudo-random in [0, 1) so the effects stay put between renders. */
const R = (n: number) => ((n * 9301 + 49297) % 233280) / 233280

export function Room() {
  const [{ snap, ui }, session] = useSession()
  const [ref, k] = useScale(roomScale)
  // Narrow screens: open the scrolling strip on the tables, not on the door.
  useEffect(() => {
    const el = ref.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = TABLE_SLOTS[1] * k - el.clientWidth / 2
  }, [ref, k])
  const P = (x: number, y: number, w: number, h: number): CSSProperties => ({ left: x * k, top: y * k, width: w * k, height: h * k })
  const at = (r: Rect) => P(r.x, r.y, r.w, r.h)

  const tables = tableSlots(snap, ui.roundId)
  const spots = hotspots(snap, ui.roundId)
  const hearth = hearthState(snap)
  const lit = hearth !== 'cold'
  const freezes = snap.player?.freezes ?? 0
  const glow = (x: number, y: number, d: number): CSSProperties => ({
    ...P(x - d / 2, y - d / 2, d, d),
    boxShadow: `0 0 ${Math.round(d * k * 0.6)}px ${Math.round(d * k * 0.25)}px rgba(255,170,70,.2)`,
  })
  const vars = (dx: number, dy: number, delay: number, dura: number) =>
    ({ '--dx': `${(dx * k).toFixed(1)}px`, '--dy': `${(dy * k).toFixed(1)}px`, animationDelay: `-${delay.toFixed(2)}s`, animationDuration: `${dura.toFixed(2)}s` }) as CSSProperties

  return (
    <div ref={ref} className="room-scroll">
      <div role="group" aria-label="The taproom" className="room" style={{ width: Math.round(ROOM_W * k), height: Math.round(ROOM_H * k) }}>
        <img className="px" src={`${PX}/scene/room_back.png`} alt="" style={P(0, 0, ROOM_W, ROOM_H)} />

        {[[188, 69], [292, 69], [376, 69]].map(([x, y]) => <div key={x} className="ab glow" style={glow(x, y, 30)} aria-hidden="true" />)}
        <div
          className="ab glow" aria-hidden="true"
          style={{ ...P(388, 112, 70, 52), boxShadow: `0 0 ${Math.round(30 * k)}px ${Math.round(10 * k)}px rgba(255,120,40,${!lit ? 0.07 : hearth === 'low' ? 0.12 : 0.22})` }}
        />
        {[[187, 68], [291, 68], [375, 68]].map(([x, y], i) => (
          <div key={x} className="ab flk" aria-hidden="true" style={{ ...P(x, y, 3, 3), animationDelay: `-${i * 0.37}s` }} />
        ))}
        {[[241, 45], [256, 51], [247, 58], [313, 46], [328, 57], [319, 51]].map(([x, y], i) => (
          <div key={`${x}-${y}`} className="ab tw" aria-hidden="true" style={{ ...P(x, y, 1, 1), animationDelay: `-${(i * 0.53).toFixed(2)}s` }} />
        ))}
        {lit
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={`s${i}`} className="ab spark" aria-hidden="true"
                style={{ ...P(410 + i * 4.5, 130 - R(i) * 6, 1, 1), ...vars((R(i + 3) - 0.5) * 14, -(16 + R(i + 7) * 16), i * 0.31, 1.3 + R(i + 11) * 0.9) }} />
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <div key={`m${i}`} className="ab smoke" aria-hidden="true"
                style={{ ...P(414 + i * 5, 138, 2, 2), ...vars((R(i + 13) - 0.3) * 10, -(22 + R(i + 17) * 14), i * 0.8, 2.8 + R(i + 19) * 1.4) }} />
            ))}

        <div className={`ab fire${hearth === 'low' ? ' fire-low' : ''}${hearth === 'cold' ? ' fire-cold' : ''}`} style={P(406, 122, 32, 28)} aria-hidden="true" />
        {Array.from({ length: freezes }, (_, i) => (
          <img key={i} className="px a-drop" src={`${PX}/props/jar_ember.svg`} alt="" style={P(404 + i * 20, 74, 22, 22)} />
        ))}

        <div className="ab" style={P(474, 76, 48, 48)}><Gnome addr={BARKEEP_ADDR} look={BARKEEP_LOOK} size={48 * k} /></div>
        <img className="px" src={`${PX}/scene/room_front.png`} alt="" style={P(0, 0, ROOM_W, ROOM_H)} />
        <img className="px" src={`${PX}/props/jar_lampoil.svg`} alt="" style={P(508, 100, 22, 22)} />

        {tables.map((t, i) => (
          <div key={t.tx}>
            {t.gnomes.map((g) => (
              <div key={g.addr} className="ab" style={at(g.rect)}><Gnome addr={g.addr} look={g.look} size={48 * k} /></div>
            ))}
            <img className="px" src={`${PX}/scene/table_room_${t.skinKey}.svg`} alt="" style={P(t.tx - 32, 154, 64, 36)} />
            {t.hourglass && <img className="px" src={`${PX}/props/hourglass_${t.hourglass}.svg`} alt="" style={P(t.tx + 12, 144, 16, 16)} />}
            {t.coins && (
              <>
                <img className="px" src={`${PX}/props/coins_${t.coins}.svg`} alt="" style={P(t.tx - 12, 144, 20, 20)} />
                <div className="ab glint" aria-hidden="true" style={{ ...P(t.tx - 4, 151, 4, 4), animationDelay: `-${(i * 1.1).toFixed(1)}s` }} />
              </>
            )}
            <div className="ab" aria-hidden="true" style={{ left: t.tx * k, top: (t.roundId === null ? 132 : 100) * k, transform: 'translateX(-50%)' }}>
              <span className="chip" style={{ color: t.labelColor, whiteSpace: 'nowrap' }}>{t.label}</span>
            </div>
          </div>
        ))}

        {Array.from({ length: 8 }, (_, i) => (
          <div key={`d${i}`} className="ab mote" aria-hidden="true"
            style={{ ...P(176 + R(i + 20) * 200, 64 + R(i + 30) * 70, 1, 1), ...vars(8 + R(i + 40) * 14, -(6 + R(i + 50) * 12), R(i + 60) * 9, 7 + R(i + 70) * 5) }} />
        ))}

        {spots.map((h) => (
          <button key={h.id} type="button" className="hs" data-tg={HOTSPOT_TG[h.id]} style={at(h.rect)} aria-label={h.tag} onClick={() => runPlace(session, h.action)}>
            <span className={`tag${h.rect.x < 60 ? ' tag-l' : h.rect.x + h.rect.w > 480 ? ' tag-r' : ''}`} aria-hidden="true">{h.tag}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
