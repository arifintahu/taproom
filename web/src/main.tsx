import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/pixel.css'
import './styles/animations.css'
import './styles/layout.css'
import App from './App.tsx'
import { loadScenario, SCENARIO } from './dev/scenarios'
import { SessionProvider } from './state/context'
import { LocalSaltStore } from './state/salts'
import { Session } from './state/session'

// Default: MockChain seeded with S1 (first visit); `?dev&scn=s8` seeds another scenario.
// `?chain=local` plays on a local gnodev chain (see realm/scripts/local-start.sh).
const q = new URLSearchParams(location.search)
const scn = q.has('dev') && q.get('scn') && SCENARIO[q.get('scn')!] ? q.get('scn')! : 's1'

declare global {
  interface Window { __taproom?: unknown }
}

// The Gno client (and its Buffer polyfill) loads only when a real chain is asked for.
const boot = q.get('chain')
  ? import('./chain/config').then(({ chainFromUrl }) => {
      const chain = chainFromUrl(q)
      if (!chain) throw new Error(`unknown chain: ${q.get('chain')}`)
      return { session: new Session({ chain, salts: new LocalSaltStore() }) }
    })
  : loadScenario(scn)

boot.then((x) => {
  const { session } = x
  // Dev only: lets e2e tests and the console drive the mock clock until the dev bar lands (milestone 8).
  if (q.has('dev')) window.__taproom = x
  session.start()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SessionProvider session={session}>
        <App />
      </SessionProvider>
    </StrictMode>,
  )
})
