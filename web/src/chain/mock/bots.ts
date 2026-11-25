import type { Look } from '../../game/constants'

/** Scripted regulars from the prototype. Addresses are display stand-ins, not real bech32. */
export const BOTS: { name: string; addr: string; look: Look }[] = [
  { name: 'Bramble', addr: 'g1br4...9ma1', look: { hat: 'h1', held: 'i1' } },
  { name: 'Thistle', addr: 'g1th2...k8s0', look: { outfit: 'o2', companion: 'c1' } },
  { name: 'Pip', addr: 'g1p9x...3dq7', look: { hat: 'h2', outfit: 'o1', held: 'i2' } },
  { name: 'Juniper', addr: 'g1ju7...w2e5', look: { hat: 'h3', outfit: 'o3', companion: 'c3' } },
  { name: 'Moss', addr: 'g1mo3...r6t2', look: { held: 'i3', companion: 'c2' } },
  { name: 'Clover', addr: 'g1cl8...v1n4', look: { hat: 'h1', outfit: 'o1' } },
  { name: 'Fennel', addr: 'g1fe5...h7y9', look: { hat: 'h4', outfit: 'o4', held: 'i4', companion: 'c4' } },
  { name: 'Wren', addr: 'g1wr1...z0p3', look: { outfit: 'o2', held: 'i1' } },
  { name: 'Sorrel', addr: 'g1so6...b5u8', look: { hat: 'h2', companion: 'c1' } },
]

export const ME_ADDR = 'g1qx7...m4k2'
export const OWNER_ADDR = 'g1own...f33s'
/** Prototype start time: Wed 25 Nov 2026 12:00 UTC, in seconds. */
export const T0 = Date.UTC(2026, 10, 25, 12, 0, 0) / 1000
