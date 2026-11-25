import { FREEZE_COST, type Slot } from '../../game/constants'
import { RARITY_COLOR, shopCards, skinCards, streakView } from '../../game/panels'
import { spendable } from '../../game/rules'
import { connected } from '../../game/selectors'
import { Gnome } from '../../scene/Gnome'
import type { ShopTab } from '../../state/session'
import { useSession } from '../../state/useSession'
import { Tabs } from '../Tabs'
import { FreezeCard } from './Hearth'

const TABS: [ShopTab, string][] = [
  ['hat', 'Hats'], ['outfit', 'Outfits'], ['held', 'Held items'], ['companion', 'Companions'], ['skin', 'Table skins'], ['freeze', 'Streak freeze'],
]

function ItemGrid({ slot }: { slot: Slot }) {
  const [{ snap }, session] = useSession()
  return (
    <div className="shop-grid">
      {shopCards(snap, slot).map((c) => (
        <article key={c.id} className={`card shop-card${c.rarity === 'legendary' ? ' legendary' : ''}`} style={{ borderColor: RARITY_COLOR[c.rarity] }}>
          <span className="portrait"><Gnome addr={snap.wallet.address || 'guest'} look={c.look} size={96} /></span>
          <h3 className="h shop-name" title={c.name}>{c.name}</h3>
          <span className="chip" style={{ color: RARITY_COLOR[c.rarity] }}>{c.word}</span>
          <p className="small">{c.price}</p>
          <button type="button" className={`pb sm full${c.owned ? '' : ' pp'}`} disabled={!!c.reason}
            aria-label={`${c.button}: ${c.name}`}
            onClick={() => (c.action === 'buy' ? session.requestBuy(c.id) : session.requestEquip(c.id, c.action === 'equip'))}>
            {c.button}
          </button>
          {c.reason && <p className="mu tiny">{c.reason}</p>}
        </article>
      ))}
    </div>
  )
}

function SkinGrid() {
  const [{ snap, ui }, session] = useSession()
  const owned = (snap.player?.skins ?? [0]).includes(ui.create.skin)
  return (
    <div className="stack">
      <p className="mu">The creator of a round must own its table. Everyone at that table sees it.</p>
      <div className="shop-grid wide-cards">
        {skinCards(snap).map((k) => (
          <article key={k.id} className="card shop-card">
            <img src={`/pixel/scene/table_room_${k.key}.svg`} alt="" className="skin-img" />
            <h3 className="h shop-name" title={k.name}>{k.name}</h3>
            <p className="small">{k.status}</p>
            <button type="button" className={`pb sm full${k.owned ? '' : ' pp'}`} disabled={k.owned || !!k.reason}
              aria-label={k.owned ? `${k.name}: owned` : `${k.button}: ${k.name}`} onClick={() => session.requestSkin(k.id)}>
              {k.button}
            </button>
            {k.reason && <p className="mu tiny">{k.reason}</p>}
          </article>
        ))}
      </div>
      {ui.create.fromShop && owned && (
        <button type="button" className="pb pp" onClick={() => session.backToCreate()}>Back to New table</button>
      )}
    </div>
  )
}

/** The tailor's wardrobe: 48 items in four slots, table skins and the streak freeze. */
export function ShopPanel() {
  const [{ snap, ui }, session] = useSession()
  const sp = snap.player ? spendable(snap.player) : 0
  return (
    <div className="stack wide-stack">
      <div className="row-between wrap">
        <p className="mu">The tailor takes points, not coins. Cosmetics never change who wins.</p>
        {connected(snap) && <span className="chip" style={{ color: 'var(--amber)' }}>{sp} points to spend</span>}
      </div>
      <Tabs label="Shop sections" tabs={TABS} value={ui.shopTab} onChange={(t) => session.setShopTab(t)}>
        {ui.shopTab === 'skin' ? <SkinGrid /> : ui.shopTab === 'freeze' ? (
          <div className="narrow">
            <FreezeCard v={streakView(snap)} primary />
            <p className="bad small">Miss more weeks than jars held: the streak resets to 1 and all jars are used up. {FREEZE_COST} points each.</p>
          </div>
        ) : <ItemGrid slot={ui.shopTab} />}
      </Tabs>
    </div>
  )
}
