import type { Chalk } from '../game/closeup'
import { fmtN } from '../game/format'

/** Chalkboard result: number line with average and target, chalk pick circles, picks table. */
export function Slate({ title, chalk: c }: { title: string; chalk: Chalk }) {
  // 74 px per row: a mark with its WINNER tag is about 70 px tall, so rows never overlap
  const h = 150 + c.maxRow * 74
  const close = Math.abs(c.avg - c.target) < 14
  return (
    <section className="slate" aria-label={title}>
      <h2 className="slate-title">{title}</h2>
      <div role="img" aria-label={c.summary} className="slate-line" style={{ height: h }}>
        <div className="slate-axis" />
        {[0, 25, 50, 75, 100].map((t) => (
          <div key={t}>
            <div className="slate-tick-label" style={{ left: `${t}%` }}>{t}</div>
            <div className="slate-tick" style={{ left: `${t}%` }} />
          </div>
        ))}
        <div className="slate-avg" style={{ left: `${c.avg}%` }} />
        <div className="slate-label" style={{ left: `${c.avg}%` }}>avg {fmtN(c.avg)}</div>
        <div className="slate-target" style={{ left: `${c.target}%` }} />
        <div className="slate-label slate-label-target" style={{ left: `${c.target}%`, marginTop: close ? 16 : 0 }}>target {fmtN(c.target)}</div>
        {c.marks.map((m) => (
          <div key={m.addr} className="slate-mark" style={{ left: `${m.left}%`, bottom: 36 + m.row * 74 }}>
            {m.win && <span className="slate-win">WINNER</span>}
            <span className={`slate-circle${m.win ? ' win' : ''}`}>{m.pick}</span>
            <span className="slate-name">{m.name}</span>
          </div>
        ))}
      </div>
      <table className="slate-table">
        <caption className="sr">Picks and distance to the target</caption>
        <thead><tr><th scope="col">Regular</th><th scope="col">Pick</th><th scope="col">Distance</th><th scope="col">Result</th></tr></thead>
        <tbody>
          {c.rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th><td>{r.pick}</td><td>{r.dist}</td>
              <td className={r.result === 'Winner' ? 'res-win' : r.result === 'Forfeit' ? 'res-forfeit' : ''}>{r.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
