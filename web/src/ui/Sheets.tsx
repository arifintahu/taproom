import { useSession } from '../state/useSession'
import { Window } from './Window'

/** Connect sheet: Adena detected (address, network, Approve) or not installed (Get Adena, check again). */
export function ConnectSheet() {
  const [{ snap }, session] = useSession()
  const w = snap.wallet
  return (
    <Window title="Guest ledger" onClose={() => session.closeSheet()}>
      {w.installed ? (
        <div className="stack">
          <p>{snap.walletName === 'Adena' ? 'Adena is ready.' : 'Local chain: a throwaway dev key in this browser signs for you.'} Sign the guest ledger to take a seat.</p>
          <div className="card stack-sm">
            <div className="row"><span className="mu">Address</span><span>{w.address}</span></div>
            <div className="row"><span className="mu">Network</span><span>{snap.networkLabel}</span></div>
          </div>
          <button type="button" className="pb pp" onClick={() => void session.connect()}>Approve connection</button>
        </div>
      ) : (
        <div className="stack">
          <p role="alert"><strong>Adena is not installed.</strong> Taproom signs with the Adena wallet extension.</p>
          <a className="pb pp" href="https://adena.app" target="_blank" rel="noreferrer">Get Adena</a>
          <button type="button" className="pb" onClick={() => void session.recheckWallet()}>I installed it, check again</button>
        </div>
      )}
    </Window>
  )
}
