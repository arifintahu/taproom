import { useSession } from '../state/useSession'
import { CopyHash } from './CopyHash'
import { Window } from './Window'

/**
 * The in-game Confirm sheet, shown before every signature: action, amount,
 * recipient and breakdown. Only Approve reaches the wallet; then broadcasting, confirmed or failed.
 */
export function ConfirmSheet() {
  const [{ snap, ui }, session] = useSession()
  const tx = ui.tx
  if (!tx) return null
  const close = () => session.closeTx()
  return (
    <Window title={tx.stage === 'confirm' ? `Confirm: ${tx.title}` : tx.title} onClose={close}>
      <div className="stack">
        <span className="chip" style={{ color: 'var(--teal)' }}>{snap.networkLabel}</span>
        <dl className="tx-rows">
          {tx.rows.map(([k, v]) => (
            <div key={k} className="row"><dt className="mu">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {tx.stage === 'confirm' && (
          <>
            <p className="mu small">Check the amount and recipient. Nothing moves until you approve and sign with {snap.walletName}.</p>
            <div className="row-wrap">
              <button type="button" className="pb" onClick={() => session.reject()}>Reject</button>
              <button type="button" className="pb pp" onClick={() => void session.approve()}>Approve and sign</button>
            </div>
          </>
        )}
        {tx.stage === 'broadcast' && (
          <>
            <p role="status" className="h">Broadcasting to {snap.network}…</p>
            <div className="tx-bar" aria-hidden="true"><div className="a-fill" /></div>
          </>
        )}
        {tx.stage === 'confirmed' && (
          <>
            <p role="status" className="good">{tx.height ? `Confirmed in block ${tx.height}.` : 'Confirmed on chain.'}</p>
            {tx.hash && <div className="row tx-hash"><span className="mu">Transaction</span><CopyHash hash={tx.hash} /></div>}
            <button type="button" className="pb pp" onClick={close}>Done</button>
          </>
        )}
        {tx.stage === 'failed' && (
          <div role="alert" className="stack">
            <p className="bad">Transaction failed: {tx.reason}</p>
            <p className="mu small">Your coins did not move.</p>
            <div className="row-wrap">
              <button type="button" className="pb" onClick={close}>Close</button>
              <button type="button" className="pb pp" onClick={() => session.retryTx()}>Try again</button>
            </div>
          </div>
        )}
        {tx.stage === 'rejected' && (
          <div role="alert" className="stack">
            <p className="h">You rejected the signature.</p>
            <p className="mu small">Nothing was sent{tx.kind === 'join' ? ' and your pick is not sealed' : ''}.</p>
            <button type="button" className="pb" onClick={close}>Close</button>
          </div>
        )}
      </div>
    </Window>
  )
}
