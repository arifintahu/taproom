import { RARITY_COLOR, regularView, streakView } from '../../game/panels'
import { connected } from '../../game/selectors'
import { Gnome } from '../../scene/Gnome'
import { recent } from '../../scene/useScale'
import { useSession } from '../../state/useSession'
import { WithdrawCard } from './Fees'
import { FreezeCard, StreakCard } from './Hearth'

/** My Regular: gnome, rank and XP, points, streak, freezes, owner fees, wardrobe, recent rounds. */
export function RegularPanel() {
  const [{ snap, ui }, session] = useSession()
  if (!connected(snap) || !snap.player) {
    return (
      <div className="stack">
        <p>Sign the guest ledger by the door to get a room upstairs.</p>
        <button type="button" className="pb pp" onClick={() => session.openSheet('connect')}>Connect wallet</button>
      </div>
    )
  }
  const v = regularView(snap)
  const st = streakView(snap)
  const lvl = recent(ui.anim, ui.wall, 'level', 1600)
  return (
    <div className="stack wide-stack">
      <div className="regular-top">
        <span className="portrait big"><Gnome addr={snap.wallet.address} look={snap.player.equipped} size={144} /></span>
        <div className="stack-sm grow">
          <p className="mu small addr">{snap.wallet.address}</p>
          <span className={`chip${lvl ? ' a-grow' : ''}`} style={{ color: 'var(--amber)', alignSelf: 'flex-start' }}>Rank: {v.rank}</span>
          <div>
            <div className="row-between small"><span>{v.xpLabel}</span><span>{v.xpText}</span></div>
            <div role="progressbar" aria-label="Progress to the next rank" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.xpPct} className="xp">
              <div className={lvl ? 'a-fill' : ''} style={{ width: `${v.xpPct}%` }} />
            </div>
          </div>
          <div className="stats">
            <div className="card stat"><p className="mu tiny">Lifetime</p><p className="h">{v.lifetime}</p></div>
            <div className="card stat"><p className="mu tiny">Spent</p><p className="h">{v.spent}</p></div>
            <div className="card stat" style={{ borderColor: 'var(--amber)' }}><p className="mu tiny">Spendable</p><p className="h">{v.spendable}</p></div>
          </div>
          <p className="mu small">Points can't be traded and never change who wins.</p>
        </div>
      </div>

      <div className="cards-grid">
        <StreakCard v={st} />
        <FreezeCard v={st} />
      </div>

      {v.owner && <WithdrawCard title="Withdraw fees" note="You're the fee recipient. Other users never see this." />}

      <section className="card stack-sm" aria-label="Wardrobe">
        <h3 className="h">Wearing</h3>
        <div className="slots">
          {v.slots.map((q) => (
            <div key={q.slot} className="slot"><p className="mu tiny">{q.label}</p><p className="h small">{q.item}</p></div>
          ))}
        </div>
        {v.owned.length === 0 && <p className="mu">Nothing in the bag yet. The tailor's wardrobe sells starter items for 40 points.</p>}
        {v.owned.map((it) => (
          <div key={it.id} className="owned-row">
            <span className="h">{it.name}</span>
            <span className="chip" style={{ color: RARITY_COLOR[it.rarity] }}>{it.word}</span>
            <button type="button" className="pb sm" data-tg={it.equipped ? undefined : `equip_${it.id}`} disabled={it.disabled} onClick={() => session.requestEquip(it.id, !it.equipped)}
              aria-label={`${it.equipped ? 'Unequip' : 'Equip'} ${it.name}`}>
              {it.equipped ? 'Unequip' : 'Equip'}
            </button>
          </div>
        ))}
      </section>

      <section className="card stack-sm" aria-label="Recent rounds">
        <h3 className="h">Recent rounds</h3>
        {v.history.length === 0 && <p className="mu">No settled rounds yet.</p>}
        {v.history.map((h) => (
          <div key={h.roundId} className="history-row">
            <span>{h.label}</span><span className="h">{h.outcome}</span><span>{h.coins}</span><span>{h.points}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
