import { useEffect, useId, useRef } from 'react'
import { useSession } from '../state/useSession'
import { SCENARIOS } from './scenarios'
import type { Guide, Mode } from './guide'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

function clockLabel(secs: number) {
  const d = new Date(secs * 1000)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}

const WIDTHS: (number | null)[] = [375, 768, 1280, null]

/** Simulation controls (dev mode only): scenario, guided/free, clock, speed, device width, motion. */
export function DevBar({ guide, width, onWidth, onLoad, onNext }: {
  guide: Guide
  width: number | null
  onWidth: (w: number | null) => void
  onLoad: (id: string, mode: Mode, step?: number) => void
  onNext: () => void
}) {
  const [{ snap, ui }, session] = useSession()
  const pickId = useId()
  const { mock } = guide.ctx
  const sc = guide.sc
  const st = guide.current
  const guided = guide.mode === 'guided'
  const barRef = useRef<HTMLDivElement>(null)

  // Windows open below the sticky bar: publish its height for the backdrop padding.
  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--dev-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--dev-h')
    }
  }, [])

  const move = async (fn: () => void) => {
    fn()
    await session.refresh()
  }
  /** The round on screen, or the first open one. */
  const roundId = () => {
    const r = session.currentRound()
    return r && !r.settled ? r.id : snap.rounds.find((q) => !q.settled)?.id
  }
  const skip = (to: 'reveal' | 'settle') =>
    move(() => {
      const id = roundId()
      if (id === undefined) session.toast('No open table to skip.')
      else mock.skipTo(id, to)
    })
  const jump = (k: number) =>
    move(() => {
      mock.jumpWeeks(k)
      session.setDev({ jumps: ui.jumps + 1 })
    })

  return (
    <div className="dev" ref={barRef}>
      <div role="toolbar" aria-label="Simulation controls" className="dev-bar">
        <label htmlFor={pickId} className="dev-label">Scenario</label>
        <select id={pickId} className="dev-select" value={sc.id} onChange={(e) => onLoad(e.target.value, guide.mode)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>{`${s.sub ? '  ' : ''}${s.code} · ${s.name}`}</option>
          ))}
        </select>
        <button type="button" className="pb sm" onClick={() => onLoad(sc.id, guide.mode)}>Restart</button>
        <div role="group" aria-label="Scenario mode" className="dev-group">
          <button type="button" className="pb sm" aria-pressed={guided} onClick={() => onLoad(sc.id, 'guided')}>Guided</button>
          <button type="button" className="pb sm" aria-pressed={!guided} onClick={() => onLoad(sc.id, 'free')}>Free</button>
        </div>
        <span className="dev-clock" aria-label="Simulated chain time">{clockLabel(mock.clock)}</span>
        <button type="button" className="pb sm" onClick={() => void move(() => mock.advance(10))}>+10 s</button>
        <button type="button" className="pb sm" data-tg="skipReveal" onClick={() => void skip('reveal')}>Skip to reveal</button>
        <button type="button" className="pb sm" data-tg="skipSettle" onClick={() => void skip('settle')}>Skip to settle</button>
        <button type="button" className="pb sm" data-tg="jumpWeek" onClick={() => void jump(1)}>Jump a week</button>
        <button type="button" className="pb sm" data-tg="jump3" onClick={() => void jump(3)}>Jump 3 weeks</button>
        <button type="button" className="pb sm" aria-pressed={ui.paused} onClick={() => session.setDev({ paused: !ui.paused })}>
          {ui.paused ? 'Play' : 'Pause'}
        </button>
        <button type="button" className="pb sm" onClick={() => session.setDev({ speed: ui.speed === 1 ? 10 : 1 })}>
          Speed {ui.speed}x
        </button>
        <div role="group" aria-label="Device width" className="dev-group">
          {WIDTHS.map((w) => (
            <button key={w ?? 'full'} type="button" className="pb sm" aria-pressed={width === w} onClick={() => onWidth(w)}>
              {w ?? 'Full'}
            </button>
          ))}
        </div>
        <button type="button" className="pb sm" aria-pressed={ui.reduced} onClick={() => session.setReduced(!ui.reduced)}>Reduced motion</button>
      </div>

      {guided && (
        <div className="dev-guide">
          <div className="dev-guide-text">
            <p className="h" aria-live="polite">
              {st ? `Step ${guide.step + 1} of ${guide.count}: ${st.t}` : `Done: all ${guide.count} steps of ${sc.code}`}
            </p>
            <p className="mu small">
              {st ? st.h ?? (st.wait ? 'Waiting step: the clock moves for you.' : 'Press Next to continue, or do it yourself.') : 'Pick another scenario, or switch to Free and keep playing.'}
            </p>
          </div>
          <div role="progressbar" aria-label="Scenario progress" aria-valuemin={0} aria-valuemax={guide.count} aria-valuenow={guide.step} className="dev-progress">
            <div style={{ width: `${(guide.step / Math.max(1, guide.count)) * 100}%` }} />
          </div>
          <button type="button" className="pb sm" disabled={guide.step === 0} onClick={() => onLoad(sc.id, 'guided', guide.step - 1)}>Back</button>
          <button type="button" className="pb sm pp" disabled={guide.finished} onClick={onNext}>Next</button>
        </div>
      )}
      {!guided && <p className="dev-free mu small">{sc.code} · {sc.desc}</p>}
    </div>
  )
}
