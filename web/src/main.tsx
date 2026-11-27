import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/pixel.css'
import './styles/animations.css'
import './styles/layout.css'
import App from './App.tsx'
import { pickChain } from './chain/pick'
import { loadScenario, SCENARIO } from './dev/scenarios'
import { SessionProvider } from './state/context'
import { LocalSaltStore } from './state/salts'
import { Session } from './state/session'

// The chain comes from `?chain=`, else the build's VITE_DEFAULT_CHAIN ("onyx" on the hosted site), else
// MockChain seeded with S1 (first visit); `?chain=mock` forces MockChain.
// `?dev` adds the simulation toolbar on MockChain: `?dev&scn=s8` picks a scenario, `&mode=free` turns guidance off.
// `?chain=local` plays on a local gnodev chain (see realm/scripts/local-start.sh); `?chain=onyx` on the Onyx testnet with Adena.
const q = new URLSearchParams(location.search)
const chainName = pickChain(q, import.meta.env.VITE_DEFAULT_CHAIN)
const scn = q.has('dev') && q.get('scn') && SCENARIO[q.get('scn')!] ? q.get('scn')! : 's1'
const root = createRoot(document.getElementById('root')!)

declare global {
  interface Window { __taproom?: unknown }
}

async function boot() {
  if (q.has('dev') && chainName === 'mock') {
    // Dev mode code loads only when asked for. It sets window.__taproom for tests and the console.
    const { DevHost } = await import('./dev/DevHost')
    root.render(
      <StrictMode>
        <DevHost initial={scn} initialMode={q.get('mode') === 'free' ? 'free' : 'guided'} />
      </StrictMode>,
    )
    return
  }

  let session: Session
  if (chainName !== 'mock') {
    // The Gno client (and its Buffer polyfill) loads only when a real chain is asked for.
    const { chainFromUrl } = await import('./chain/config')
    const chain = chainFromUrl(chainName, q)
    if (!chain) throw new Error(`unknown chain: ${chainName}`)
    session = new Session({ chain, salts: new LocalSaltStore() })
    if (q.has('dev')) window.__taproom = { session }
  } else {
    session = (await loadScenario(scn)).session
  }
  session.start()
  root.render(
    <StrictMode>
      <SessionProvider session={session}>
        <App />
      </SessionProvider>
    </StrictMode>,
  )
}

void boot()
