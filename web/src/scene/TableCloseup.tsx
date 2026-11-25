import { useEffect, type CSSProperties } from 'react'
import { CU_H, CU_W, closeupScale, potX, roundView, seats, slateText } from '../game/closeup'
import { SKINS } from '../game/constants'
import { phaseOf } from '../game/rules'
import type { Round } from '../game/types'
import { useSession } from '../state/useSession'
import { Gnome } from './Gnome'
import { px, recent, useScale } from './useScale'

const PX = '/pixel'

/** The long table, handover 6.3: wall slate, seated gnomes, slips, names, pot. */
export function TableCloseup({ round: r }: { round: Round }) {
  const [{ snap, ui }] = useSession()
  const [ref, k] = useScale(closeupScale)
  const Q = px(k)
  // Narrow screens: open the scrolling strip on the middle of the table.
  useEffect(() => {
    const el = ref.current
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (CU_W / 2) * k - el.clientWidth / 2
  }, [ref, k])
  const ph = phaseOf(r, snap.now)
  const list = seats(snap, r)
  const looks = new Map(r.entries.map((e) => [e.addr, e.look]))
  const v = roundView(snap, r)
  const [s1, s2, s3] = slateText(snap, r)
  const pot = potX(snap, r)
  const n = r.entries.length
  const coin = n <= 2 ? 's' : n <= 5 ? 'm' : 'l'
  const fs1 = Math.max(10, Math.round(4.4 * k))
  const fs2 = Math.max(18, Math.round(13 * k))
  const fsSlip = Math.max(10, Math.round(5.5 * k))
  const fsName = Math.max(11, Math.min(14, Math.round(4 * k)))
  const glow = (x: number, y: number, d: number): CSSProperties => ({
    ...Q(x - d / 2, y - d / 2, d, d),
    boxShadow: `0 0 ${Math.round(d * k * 0.6)}px ${Math.round(d * k * 0.25)}px rgba(255,170,70,.2)`,
  })
  const joinDrop = recent(ui.anim, ui.wall, 'join', 1600) ? ' a-drop' : ''

  return (
    <div ref={ref} className="room-scroll">
      <div role="group" aria-label={`The table: ${v.seatsText}, pot ${v.pot} GNOT`} className="room" style={{ width: Math.round(CU_W * k), height: Math.round(CU_H * k) }}>
        <img className="px" src={`${PX}/scene/closeup.png`} alt="" style={Q(0, 0, CU_W, CU_H)} />
        <div className="ab glow" aria-hidden="true" style={glow(76, 39, 30)} />
        <div className="ab glow" aria-hidden="true" style={glow(272, 39, 30)} />
        <div className="ab flk" aria-hidden="true" style={Q(75, 38, 3, 3)} />
        <div className="ab flk" aria-hidden="true" style={{ ...Q(271, 38, 3, 3), animationDelay: '-.4s' }} />
        {[[28, 27, 0], [41, 33, 1.2], [33, 40, 0.6]].map(([x, y, d]) => (
          <div key={x} className="ab tw" aria-hidden="true" style={{ ...Q(x, y, 1, 1), animationDelay: `-${d}s` }} />
        ))}

        <div className="ab cu-slate" aria-hidden="true" style={{ ...Q(96, 8, 128, 54), borderWidth: Math.max(3, Math.round(3 * k)) }}>
          <span style={{ fontSize: fs1, fontWeight: 700, color: 'var(--chalk)' }}>{s1}</span>
          <span style={{ fontSize: fs2, fontWeight: 700 }}>{s2}</span>
          <span style={{ fontSize: fs1 }}>{s3}</span>
        </div>

        {list.map((x) => (
          <div key={x.addr} className="ab" style={Q(x.x, 74, 48, 48)}><Gnome addr={x.addr} look={looks.get(x.addr)} size={48 * k} /></div>
        ))}
        <img className="px" src={`${PX}/scene/table_long_${SKINS[r.skin]?.key ?? 'oak'}.svg`} alt="" style={Q(10, 108, 300, 40)} />
        {(ph === 'commit' || ph === 'reveal') && (
          <img className="px" src={`${PX}/props/hourglass_${ph === 'commit' ? 'full' : 'half'}.svg`} alt="" style={Q(18, 90, 26, 26)} />
        )}

        {list.map((x) => (
          <div key={`slip-${x.addr}`}>
            <div className={`ab${x.open && recent(ui.anim, ui.wall, `flip:${x.addr}`) ? ' a-flip' : ''}`} style={Q(x.x + 13, 98, 22, 22)} aria-hidden="true">
              <img className="px" src={`${PX}/props/slip_${x.open ? 'open' : 'sealed'}.svg`} alt="" style={{ left: 0, top: 0, width: '100%', height: '100%' }} />
              {x.open && <span className="slip-num" style={{ fontSize: fsSlip, paddingTop: Math.round(2 * k) }}>{x.pick}</span>}
            </div>
            <div className="ab cu-name" style={{ ...Q(x.x + 2, 128, 44, 20), fontSize: fsName }}>
              {x.winner && <span className="cu-win">WINNER</span>}
              <span className="cu-tag">{x.name}</span>
              <span className="cu-tag" style={{ color: x.color }}>{x.status}</span>
            </div>
          </div>
        ))}

        {n > 0 && (
          <>
            <img className={`px pot${joinDrop}`} src={`${PX}/props/coins_${coin}.svg`} alt="" style={Q(pot, 92, 26, 26)} />
            <div className="ab glint" aria-hidden="true" style={Q(pot + 11, 100, 4, 4)} />
            <div className="ab pot" style={{ left: (pot + 13) * k, top: 88 * k, transform: 'translate(-50%,-100%)' }}>
              <span className="chip" style={{ color: 'var(--amber)', whiteSpace: 'nowrap' }}>Pot {v.pot} GNOT</span>
            </div>
          </>
        )}
        {v.skinNote && (
          <div className="ab" style={{ left: 160 * k, top: 66 * k, transform: 'translateX(-50%)' }}>
            <span className="chip" style={{ color: '#cfe3ff', whiteSpace: 'nowrap' }}>{v.skinNote}</span>
          </div>
        )}
      </div>
    </div>
  )
}
