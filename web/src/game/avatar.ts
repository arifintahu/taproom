import type { Look, Slot } from './constants'

export const BASE_COMBOS = 8
export const ITEM_FRAMES = 12

/** Base combo (skin, beard, cap colour) from the address: h = 7; h = h*31 + c; combo = h % 8. */
export function addrHash(addr: string): number {
  let h = 7
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0
  return h
}

export type LayerSheet = 'comp' | 'body' | 'outfit' | 'head' | 'blink' | 'hat' | 'cap' | 'held'

export interface AvatarLayer {
  sheet: LayerSheet
  frame: number
  frames: number
}

const SHEET_OF: Record<Slot, LayerSheet> = { hat: 'hat', outfit: 'outfit', held: 'held', companion: 'comp' }
const itemFrame = (code: string) => parseInt(code.slice(1), 10) - 1

/** Layers back to front: companion, body, outfit, head, blink, hat (or cap), held. */
export function avatarLayers(addr: string, look: Look = {}) {
  const h = addrHash(addr)
  const combo = h % BASE_COMBOS
  const item = (slot: Slot): AvatarLayer | null => {
    const code = look[slot]
    return code ? { sheet: SHEET_OF[slot], frame: itemFrame(code), frames: ITEM_FRAMES } : null
  }
  const base = (sheet: LayerSheet): AvatarLayer => ({ sheet, frame: combo, frames: BASE_COMBOS })
  const layers = [
    item('companion'),
    base('body'),
    item('outfit'),
    base('head'),
    base('blink'),
    item('hat') ?? base('cap'),
    item('held'),
  ].filter((l): l is AvatarLayer => l !== null)
  return {
    combo,
    layers,
    /** Animation phase and speed from the hash, so a crowd never bobs in sync. */
    bobDelay: (h % 23) / 10,
    bobDuration: 1.5 + (h % 7) / 10,
    blinkDelay: (h % 41) / 10,
    blinkDuration: 3.6 + (h % 9) / 5,
  }
}
