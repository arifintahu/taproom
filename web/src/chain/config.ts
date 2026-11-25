// Which chain the app talks to. Default: MockChain. `?chain=local` uses a local gnodev chain
// (realm/scripts/local-start.sh), signed by a throwaway dev key, or by Adena with `&signer=adena`.

import './gno/polyfill' // must load before the Gno client modules
import { GnoChain } from './gno/GnoChain'
import { AdenaSigner, DevKeySigner } from './gno/signers'

export const LOCAL = {
  rpc: 'http://127.0.0.1:26657',
  network: 'dev',
  networkLabel: 'Local gnodev',
  realmPath: 'gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom',
}

export function chainFromUrl(q: URLSearchParams): GnoChain | null {
  if (q.get('chain') !== 'local') return null
  const signer = q.get('signer') === 'adena'
    ? new AdenaSigner({ chainId: LOCAL.network, chainName: LOCAL.networkLabel, rpcUrl: LOCAL.rpc })
    : new DevKeySigner(LOCAL.rpc)
  return new GnoChain({ ...LOCAL, signer })
}
