import { useRef } from 'react'
import { fmtG } from '../../game/format'
import { connected } from '../../game/selectors'
import type { SaltRecord } from '../../state/salts'
import { useSession } from '../../state/useSession'

const isRecord = (x: unknown): x is SaltRecord => {
  const r = x as SaltRecord
  return !!r && typeof r.realm === 'string' && Number.isInteger(r.roundId) && typeof r.address === 'string' &&
    Number.isInteger(r.pick) && r.pick >= 0 && r.pick <= 100 && typeof r.salt === 'string' && r.salt.length > 0
}

/** Guest ledger and settings: wallet, chain, realm, reduce motion, pick backup, fee note. */
export function SettingsPanel() {
  const [{ snap, ui }, session] = useSession()
  const file = useRef<HTMLInputElement>(null)
  const on = connected(snap)

  const download = () => {
    const blob = new Blob([JSON.stringify(session.salts.all(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'taproom-picks.json'
    a.click()
    URL.revokeObjectURL(a.href)
    session.toast(`Backup saved: ${session.salts.all().length} sealed pick(s).`)
  }

  const importFile = async (f: File) => {
    try {
      const data: unknown = JSON.parse(await f.text())
      const list = Array.isArray(data) ? data.filter(isRecord) : []
      list.forEach((r) => session.salts.save(r))
      session.toast(list.length ? `Imported ${list.length} sealed pick(s).` : 'No sealed picks found in that file.')
    } catch {
      session.toast("That file isn't a Taproom pick backup.")
    }
  }

  return (
    <div className="stack wide-stack">
      <section className="card stack-sm">
        <h3 className="h">Guest ledger</h3>
        <div className="row"><span>Wallet</span><span className="addr">{on ? `${snap.wallet.address} · ${fmtG(snap.wallet.balance)} GNOT` : 'Not connected'}</span></div>
        <div className="row"><span>Chain</span><span>{snap.networkLabel}</span></div>
        <div className="row"><span>Realm</span><span className="addr">{snap.realm}</span></div>
        {!on && <button type="button" className="pb pp" style={{ alignSelf: 'flex-start' }} onClick={() => session.openSheet('connect')}>Connect wallet</button>}
      </section>
      <section className="card stack-sm">
        <h3 className="h">Motion</h3>
        <label className="check">
          <input type="checkbox" checked={ui.reduced} onChange={(e) => session.setReduced(e.target.checked)} />
          <span>Reduce motion (fire, flips and pulses become fades)</span>
        </label>
      </section>
      <section className="card stack-sm">
        <h3 className="h">Pick backup</h3>
        <p>Your sealed picks and their secret salts live in this browser. Lose them and you can't reveal.</p>
        <div className="row-wrap">
          <button type="button" className="pb" onClick={download}>Download backup</button>
          <button type="button" className="pb" onClick={() => file.current?.click()}>Import backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-hidden="true" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '' }} />
        </div>
      </section>
      <section className="card stack-sm">
        <h3 className="h">Fees</h3>
        <p>The tavern keeps 0.5% of the pot on completed rounds. It goes to the owner's treasury address <span className="addr">{snap.feeRecipient}</span>; only WithdrawFees can move it.</p>
      </section>
    </div>
  )
}
