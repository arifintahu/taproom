// Which chain the app talks to. Default: MockChain. `?chain=local` uses a local gnodev chain
// (realm/scripts/local-start.sh), signed by a throwaway dev key, or by Adena with `&signer=adena`.
// `?chain=onyx` uses the public Onyx testnet and always signs with Adena.

import './gno/polyfill' // must load before the Gno client modules
import { GnoChain } from './gno/GnoChain'
import { AdenaSigner, DevKeySigner } from './gno/signers'

const REALM = 'gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom/v1'

export const LOCAL = {
  rpc: 'http://127.0.0.1:26657',
  network: 'dev',
  networkLabel: 'Local gnodev',
  realmPath: REALM,
}

export const ONYX = {
  rpc: 'https://rpc.onyx.testnets.gno.land:443',
  network: 'onyx-1',
  networkLabel: 'Testnet onyx-1',
  realmPath: REALM,
}

export function chainFromUrl(chain: string, q: URLSearchParams): GnoChain | null {
  if (chain === 'onyx') {
    const signer = new AdenaSigner({ chainId: ONYX.network, chainName: ONYX.networkLabel, rpcUrl: ONYX.rpc })
    return new GnoChain({ ...ONYX, signer })
  }
  if (chain !== 'local') return null
  const signer = q.get('signer') === 'adena'
    ? new AdenaSigner({ chainId: LOCAL.network, chainName: LOCAL.networkLabel, rpcUrl: LOCAL.rpc })
    : new DevKeySigner(LOCAL.rpc)
  return new GnoChain({ ...LOCAL, signer })
}
