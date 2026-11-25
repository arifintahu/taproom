import { LINES } from '../../game/constants'
import { regularView } from '../../game/panels'
import { useSession } from '../../state/useSession'

export function WithdrawCard({ title, note }: { title: string; note?: string }) {
  const [{ snap }, session] = useSession()
  const v = regularView(snap)
  return (
    <section className="card stack-sm" style={{ borderColor: 'var(--amber)' }} aria-label="Withdraw fees">
      <h3 className="h">{title}</h3>
      {note && <p>{note}</p>}
      <div className="row"><span>Accrued</span><span>{v.fees} GNOT</span></div>
      <div className="row"><span>To</span><span className="addr">{snap.feeRecipient}</span></div>
      <button type="button" className="pb pp" style={{ alignSelf: 'flex-start' }} disabled={v.withdrawDisabled} onClick={() => session.requestWithdraw()}>
        Withdraw {v.fees} GNOT
      </button>
    </section>
  )
}

/** The lamp-oil jar: how the fee works; the owner also sees Withdraw. */
export function FeesPanel() {
  const [{ snap }] = useSession()
  const v = regularView(snap)
  return (
    <div className="stack wide-stack">
      <p>“{LINES.fee}”</p>
      <p>
        0.5% of the pot on completed rounds (2 or more reveals). Cancelled rounds refund everyone and pay no fee. The fee goes to
        the owner's treasury address <span className="addr">{snap.feeRecipient}</span>, and only WithdrawFees can move it.
      </p>
      {v.owner && <WithdrawCard title="You hold the jar's key" />}
    </div>
  )
}
