import { useEffect } from 'react'
import { Room } from './scene/Room'
import { useSession } from './state/useSession'
import { DialogBox, PlacesRow, Toasts } from './ui/DialogBox'
import { Banners, Hud } from './ui/Hud'
import { ConfirmSheet } from './ui/ConfirmSheet'
import { Panel } from './ui/Panels'
import { CreateSheet } from './ui/panels/CreateSheet'
import { ConnectSheet } from './ui/Sheets'
import { TableView } from './ui/TableView'

export default function App() {
  const [{ ui }, session] = useSession()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) session.setReduced(true)
    const on = (e: MediaQueryListEvent) => session.setReduced(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [session])

  return (
    <div className={`app${ui.reduced ? ' rm' : ''}`}>
      <div className="frame">
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
      <ConfirmSheet />
      <Toasts />
    </div>
  )
}
