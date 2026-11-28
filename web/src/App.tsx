import { useContext, useEffect } from 'react'
import { ViewportContext } from './scene/viewport'
import { Room } from './scene/Room'
import { useSession } from './state/useSession'
import { DialogBox, PlacesRow, Toasts } from './ui/DialogBox'
import { Banners, Hud } from './ui/Hud'
import { ConfirmSheet } from './ui/ConfirmSheet'
import { Panel } from './ui/Panels'
import { CreateSheet } from './ui/panels/CreateSheet'
import { ConnectSheet, WelcomeSheet } from './ui/Sheets'
import { welcomeSeen } from './state/welcome'
import { TableView } from './ui/TableView'

export default function App() {
  const [{ ui }, session] = useSession()
  const simulated = useContext(ViewportContext)

  useEffect(() => {
    if (!session.mock && !welcomeSeen()) session.openSheet('welcome')
  }, [session])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) session.setReduced(true)
    const on = (e: MediaQueryListEvent) => session.setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [session])

  return (
    <div className={`app${ui.reduced ? ' rm' : ''}`}>
      <div className="frame" style={simulated ? { maxWidth: simulated } : undefined}>
        <Hud />
        <Banners />
        <main>
          {ui.view === 'room' ? (
            <>
              <h1 className="sr">Taproom, a tavern of mind games</h1>
              <Room />
              <PlacesRow />
              <DialogBox />
            </>
          ) : (
            <TableView />
          )}
        </main>
      </div>
      {ui.panel && <Panel panel={ui.panel} />}
      {ui.sheet === 'connect' && <ConnectSheet />}
      {ui.sheet === 'create' && <CreateSheet />}
      {ui.sheet === 'welcome' && <WelcomeSheet />}
      <ConfirmSheet />
      <Toasts />
    </div>
  )
}
