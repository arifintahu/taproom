import type { PanelId } from '../state/session'
import { useSession } from '../state/useSession'
import { FeesPanel } from './panels/Fees'
import { HallPanel } from './panels/Hall'
import { HearthPanel } from './panels/Hearth'
import { HowToPanel } from './panels/HowTo'
import { RegularPanel } from './panels/Regular'
import { SettingsPanel } from './panels/Settings'
import { ShopPanel } from './panels/Shop'
import { Window } from './Window'

const TITLE: Record<PanelId, string> = {
  regular: 'My Regular', hearth: 'The hearth', fees: 'The lamp-oil jar', shop: "The tailor's wardrobe",
  hall: 'The Hall', howto: 'How to play', settings: 'Guest ledger and settings',
}

const BODY: Record<PanelId, () => React.JSX.Element> = {
  regular: RegularPanel, hearth: HearthPanel, fees: FeesPanel, shop: ShopPanel, hall: HallPanel, howto: HowToPanel, settings: SettingsPanel,
}

/** The open place window (handover section 8). */
export function Panel({ panel }: { panel: PanelId }) {
  const [, session] = useSession()
  const Body = BODY[panel]
  return (
    <Window title={TITLE[panel]} onClose={() => session.closePanel()} wide>
      <Body />
    </Window>
  )
}
