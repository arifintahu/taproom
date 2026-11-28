import { useSession } from '../state/useSession'
import { markWelcomed } from '../state/welcome'
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
          <button type="button" className="pb pp" data-tg="connectOk" onClick={() => void session.connect()}>Approve connection</button>
        </div>
      ) : (
        <div className="stack">
          <p role="alert"><strong>Adena is not installed.</strong> Taproom signs with the Adena wallet extension.</p>
          <a className="pb pp" href="https://adena.app" target="_blank" rel="noreferrer">Get Adena</a>
          <button type="button" className="pb" data-tg="recheck" onClick={() => void session.recheckWallet()}>I installed it, check again</button>
          {!session.mock && <a className="pb" href="?chain=mock">Practice without a wallet</a>}
        </div>
      )}
    </Window>
  )
}

/** First visit on a real chain: practise on a simulated table, or play on the testnet with Adena. */
export function WelcomeSheet() {
  const [{ snap }, session] = useSession()
  const close = () => {
    markWelcomed()
    session.closeSheet()
  }
  const adena = snap.wallet.installed
  return (
    <Window title="Welcome to the Taproom" onClose={close}>
      <div className="stack">
        <p>Seal a number from 0 to 100. When the seals break, the pick closest to 2/3 of the average takes the pot.</p>
        <div className="card stack-sm">
          <p className="h">Practice now</p>
          <p className="mu">A simulated table with five regulars. No wallet, nothing is sent to a chain.</p>
          <a className={`pb${adena ? '' : ' pp'}`} href="?chain=mock" data-tg="welcomePractice" onClick={markWelcomed}>Practice without a wallet</a>
        </div>
        <div className="card stack-sm">
          <p className="h">Play on the testnet</p>
          <ol className="steps">
            <li>{adena ? 'Adena is installed.' : <>Install the <a href="https://adena.app" target="_blank" rel="noreferrer">Adena wallet</a>.</>}</li>
            <li>Get free test GNOT at <a href="https://faucet.gno.land" target="_blank" rel="noreferrer">faucet.gno.land</a>.</li>
            <li>Connect, pick a table and seal your number for 1 test GNOT.</li>
          </ol>
          <button type="button" className={`pb${adena ? ' pp' : ''}`} data-tg="welcomeOnyx" onClick={close}>Play on the testnet</button>
        </div>
      </div>
    </Window>
  )
}
