import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdenaSigner, txHashHex } from './signers'

// Responses follow docs.adena.app (2026-11-25): { code, status, type, message, data }.
const ok = (type: string, data: unknown = {}) => ({ code: 0, status: 'success' as const, type, message: '', data })
const fail = (code: number, type: string, message = '') => ({ code, status: 'failure' as const, type, message })

const NET = { chainId: 'dev', chainName: 'Local gnodev', rpcUrl: 'http://127.0.0.1:26657' }
const ME = 'g1gvp2s30w0l02y3ectmy785p6jvfj9v9vaw4qc8'
const HASH = '456f' + 'ab'.repeat(30)

function fakeAdena(over: Record<string, unknown> = {}) {
  const api = {
    AddEstablish: vi.fn(async () => ok('CONNECTION_SUCCESS')),
    GetAccount: vi.fn(async () => ok('GET_ACCOUNT', { address: ME, chainId: 'dev', status: 'ACTIVE' })),
    // shape seen from the real extension on local gnodev: hex hash, Log, no height
    DoContract: vi.fn(async () => ok('TRANSACTION_SUCCESS', { hash: HASH, Log: '', error: null, data: null })),
    AddNetwork: vi.fn(async () => ok('ADD_NETWORK_SUCCESS')),
    SwitchNetwork: vi.fn(async () => ok('SWITCH_NETWORK_SUCCESS')),
    On: vi.fn(),
    ...over,
  }
  ;(globalThis as unknown as { adena?: unknown }).adena = api
  return api
}

afterEach(() => { delete (globalThis as unknown as { adena?: unknown }).adena })

describe('AdenaSigner', () => {
  it('is not installed without window.adena', async () => {
    const s = new AdenaSigner(NET)
    expect(s.installed()).toBe(false)
    expect(await s.connect()).toBeNull()
  })

  it('connects, and treats ALREADY_CONNECTED as connected', async () => {
    fakeAdena({ AddEstablish: vi.fn(async () => fail(4001, 'ALREADY_CONNECTED')) })
    expect(await new AdenaSigner(NET).connect()).toEqual({ address: ME, network: 'dev' })
  })

  it('a rejected connection throws with Adena\'s message', async () => {
    fakeAdena({ AddEstablish: vi.fn(async () => fail(4000, 'CONNECTION_REJECTED', 'User rejected the connection.')) })
    await expect(new AdenaSigner(NET).connect()).rejects.toThrow('User rejected the connection.')
  })

  it('sends Join as /vm.m_call with the entry fee and returns a hex hash', async () => {
    const a = fakeAdena()
    const r = await new AdenaSigner(NET).call({ realm: 'gno.land/r/x/taproom', func: 'Join', args: ['0', 'ab'], send: 1_000_000, gasWanted: 20_000_000 })
    expect(r).toEqual({ ok: true, hash: HASH.toUpperCase(), height: 0 })
    expect(a.DoContract).toHaveBeenCalledWith({
      messages: [{ type: '/vm.m_call', value: { caller: ME, send: '1000000ugnot', pkg_path: 'gno.land/r/x/taproom', func: 'Join', args: ['0', 'ab'] } }],
      gasFee: 20_000,
      gasWanted: 20_000_000,
    })
  })

  it('maps rejection, a locked wallet and chain failures', async () => {
    const call = { realm: 'r', func: 'Settle', args: ['0'], gasWanted: 1000 }
    fakeAdena({ DoContract: vi.fn(async () => fail(4000, 'TRANSACTION_REJECTED')) })
    expect(await new AdenaSigner(NET).call(call)).toEqual({ ok: false, rejected: true, reason: 'You rejected the signature in Adena.' })
    fakeAdena({ DoContract: vi.fn(async () => fail(2000, 'WALLET_LOCKED')) })
    expect(await new AdenaSigner(NET).call(call)).toMatchObject({ ok: false, reason: 'Adena is locked. Unlock it and try again.' })
    fakeAdena({ DoContract: vi.fn(async () => fail(4001, 'TRANSACTION_FAILED', 'panic: reveal window still open')) })
    expect(await new AdenaSigner(NET).call(call)).toMatchObject({ ok: false, reason: 'reveal window still open' })
    fakeAdena({ DoContract: vi.fn(async () => ({ ...fail(4001, 'TRANSACTION_FAILED', 'Transaction failed.'), data: { hash: '', Log: 'panic: already settled\nstack' } })) })
    expect(await new AdenaSigner(NET).call(call)).toMatchObject({ ok: false, reason: 'already settled' })
  })

  it('switches network, adding it first when Adena does not know it', async () => {
    const sw = vi.fn().mockResolvedValueOnce(fail(4001, 'UNADDED_NETWORK')).mockResolvedValueOnce(ok('SWITCH_NETWORK_SUCCESS'))
    const a = fakeAdena({ SwitchNetwork: sw })
    await new AdenaSigner(NET).switchNetwork()
    expect(a.AddNetwork).toHaveBeenCalledWith(NET)
    expect(sw).toHaveBeenCalledTimes(2)
    fakeAdena({ SwitchNetwork: vi.fn(async () => fail(4001, 'REDUNDANT_CHANGE_REQUEST')) })
    await expect(new AdenaSigner(NET).switchNetwork()).resolves.toBeUndefined()
    fakeAdena({ SwitchNetwork: vi.fn(async () => fail(4000, 'SWITCH_NETWORK_REJECTED', 'rejected')) })
    await expect(new AdenaSigner(NET).switchNetwork()).rejects.toThrow('rejected')
  })

  it('listens for account and network changes', () => {
    const a = fakeAdena()
    const cb = vi.fn()
    new AdenaSigner(NET).onChange(cb)
    expect(a.On.mock.calls.map((c) => c[0])).toEqual(['changedAccount', 'changedNetwork'])
    ;(a.On.mock.calls[1][1] as (v: string) => void)('dev')
    expect(cb).toHaveBeenCalled()
  })

  it('tx hash: hex as returned, base64 (per the docs) decoded', () => {
    expect(txHashHex(HASH)).toBe(HASH.toUpperCase())
    expect(txHashHex(btoa(String.fromCharCode(...new Array(32).fill(171))))).toBe('AB'.repeat(32))
  })
})
