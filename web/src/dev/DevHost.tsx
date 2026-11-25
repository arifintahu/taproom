// Dev mode (?dev): the app plus a simulation toolbar for demos and judging. Loads scenarios S1-S13,
// guides them step by step, moves the mock clock and simulates device widths. Hidden from players.

import { useEffect, useReducer, useState } from 'react'
import App from '../App'
import { ViewportContext } from '../scene/viewport'
import { SessionProvider } from '../state/context'
import { DevBar } from './DevBar'
import { loadAt, type Guide, type Mode } from './guide'

declare global {
  interface Window { __taproom?: unknown }
}

/** Teal pulse on the control the current guided step points at (elements carry data-tg="key"). */
function pulseCss(tg: string | undefined) {
  if (!tg) return ''
  const sel = `[data-tg="${tg.replace(/"/g, '')}"]`
  return `${sel} { outline: 3px solid var(--teal) !important; outline-offset: 3px; animation: pl 1.2s ease-in-out infinite; z-index: 2; }
${sel}:not(.hs) { position: relative; }
.hs${sel} .tag { display: block; }
.rm ${sel} { animation: none; outline-style: dashed !important; }
@media (prefers-reduced-motion: reduce) { ${sel} { animation: none; outline-style: dashed !important; } }`
}

export function DevHost({ initial, initialMode }: { initial: string; initialMode: Mode }) {
  const [guide, setGuide] = useState<Guide | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const [request, setRequest] = useState({ id: initial, mode: initialMode, step: 0, n: 0 })

  // (Re)load a scenario whenever one is requested; the previous session stops.
  useEffect(() => {
    let alive = true
    let loaded: Guide | null = null
    void loadAt(request.id, request.mode, request.step).then((g) => {
      if (!alive) return
      loaded = g
      g.ctx.session.start()
      window.__taproom = g.ctx
      setGuide(g)
    })
    return () => {
      alive = false
      loaded?.ctx.session.stop()
    }
  }, [request])

  // Follow the session: advance guided steps when their checks pass; let waiting steps run themselves.
  useEffect(() => {
    if (!guide) return
    const unsubscribe = guide.ctx.session.subscribe(() => {
      guide.check()
      rerender()
    })
    const timer = setInterval(() => void guide.tick().then((moved) => moved && rerender()), 250)
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [guide])

  if (!guide) return <p className="dev-loading">Loading scenario…</p>

  const load = (id: string, mode: Mode, step = 0) => setRequest((r) => ({ id, mode, step, n: r.n + 1 }))

  return (
    <ViewportContext.Provider value={width}>
      <SessionProvider session={guide.ctx.session}>
        <DevBar
          guide={guide}
          width={width}
          onWidth={setWidth}
          onLoad={load}
          onNext={() => void guide.next().then(rerender)}
        />
        <App />
        <style>{pulseCss(guide.target())}</style>
      </SessionProvider>
    </ViewportContext.Provider>
  )
}
