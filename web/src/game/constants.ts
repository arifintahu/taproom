// Game constants, matching the realm (realm/taproom/taproom.gno). Amounts are in ugnot, times in seconds.

export const UGNOT_PER_GNOT = 1_000_000
export const ENTRY_FEE = 1_000_000
export const FEE_BPS = 50
export const BPS_TOTAL = 10_000
export const MAX_PLAYERS = 10
export const MAX_OPEN_ROUNDS = 3
export const TARGET_NUM = 2
export const TARGET_DEN = 3

export const POINTS_PLAY = 10
export const POINTS_WIN = 30
export const STREAK_STEP = 4
export const STREAK_CAP = 20
export const FREEZE_COST = 40
export const MAX_FREEZES = 2

export const WEEK_SECONDS = 604_800
/** Unix time zero was a Thursday; 4 days shift week boundaries to Monday 00:00 UTC. */
export const WEEK_OFFSET = 345_600

export const NETWORK = 'onyx-1'
export const REALM_PATH = 'gno.land/r/g1own...f33s/taproom'

export type PresetId = 'quick' | 'standard' | 'daily'
export interface Preset {
  id: PresetId
  label: string
  commitSecs: number
  revealSecs: number
  desc: string
}
export const PRESETS: Record<PresetId, Preset> = {
  quick: { id: 'quick', label: 'Quick', commitSecs: 120, revealSecs: 120, desc: '2 + 2 minutes' },
  standard: { id: 'standard', label: 'Standard', commitSecs: 1800, revealSecs: 1800, desc: '30 + 30 minutes' },
  daily: { id: 'daily', label: 'Daily', commitSecs: 43_200, revealSecs: 43_200, desc: '12 + 12 hours' },
}
export const PRESET_IDS: PresetId[] = ['quick', 'standard', 'daily']

/** Preset of a round from its window lengths (the realm stores only the end times). */
export function presetOf(commitSecs: number): PresetId {
  if (commitSecs >= PRESETS.daily.commitSecs) return 'daily'
  if (commitSecs >= PRESETS.standard.commitSecs) return 'standard'
  return 'quick'
}

/** Board skins: index = realm skin ID (Oak 0, Moonlit 1, Gold-trim 2). */
export type SkinKey = 'oak' | 'moon' | 'gold'
export interface Skin {
  id: number
  key: SkinKey
  name: string
  price: number
}
export const SKINS: Skin[] = [
  { id: 0, key: 'oak', name: 'Oak table', price: 0 },
  { id: 1, key: 'moon', name: 'Moonlit table', price: 150 },
  { id: 2, key: 'gold', name: 'Gold-trim table', price: 400 },
]

export const RANKS: [number, string][] = [
  [0, 'Newcomer'],
  [100, 'Regular'],
  [500, 'Sharp'],
  [1500, 'Oracle'],
  [4000, 'Legend'],
]

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export const RARITY: Record<Rarity, { word: string; style: number; price: number }> = {
  common: { word: 'Common', style: 1, price: 40 },
  rare: { word: 'Rare', style: 3, price: 150 },
  epic: { word: 'Epic', style: 6, price: 400 },
  legendary: { word: 'Legendary', style: 10, price: 1000 },
}

export type Slot = 'hat' | 'outfit' | 'held' | 'companion'
export const SLOTS: Slot[] = ['hat', 'outfit', 'held', 'companion']

/** UI item code, e.g. 'h7'. The realm stores slotBase + n (hat 100, outfit 200, held 300, companion 400). */
export type ItemCode = string
export interface Item {
  id: ItemCode
  slot: Slot
  name: string
  rarity: Rarity
  price: number
}

const RAW_ITEMS: [ItemCode, Slot, string, Rarity][] = [
  ['h1', 'hat', 'Feather band', 'common'], ['h5', 'hat', 'Straw hat', 'common'], ['h6', 'hat', 'Knit beanie', 'common'],
  ['h2', 'hat', 'Toadstool cap', 'rare'], ['h7', 'hat', 'Pirate tricorn', 'rare'], ['h8', 'hat', 'Flower crown', 'rare'],
  ['h3', 'hat', 'Star hood', 'epic'], ['h9', 'hat', 'Horned helm', 'epic'], ['h10', 'hat', "Witch's brim", 'epic'],
  ['h4', 'hat', 'Lamp crown', 'legendary'], ['h11', 'hat', 'Phoenix plume', 'legendary'], ['h12', 'hat', 'Candle crown', 'legendary'],
  ['o1', 'outfit', 'Barley apron', 'common'], ['o5', 'outfit', 'Overalls', 'common'], ['o6', 'outfit', 'Striped scarf', 'common'],
  ['o2', 'outfit', 'Moss vest', 'rare'], ['o7', 'outfit', 'Leather jerkin', 'rare'], ['o8', 'outfit', "Bard's doublet", 'rare'],
  ['o3', 'outfit', 'Night robe', 'epic'], ['o9', 'outfit', "Knight's tabard", 'epic'], ['o10', 'outfit', 'Alchemist coat', 'epic'],
  ['o4', 'outfit', 'Ember cloak', 'legendary'], ['o11', 'outfit', 'Frost mantle', 'legendary'], ['o12', 'outfit', 'Golden plate', 'legendary'],
  ['i1', 'held', 'Clay mug', 'common'], ['i5', 'held', 'Wooden spoon', 'common'], ['i6', 'held', 'Crusty loaf', 'common'],
  ['i2', 'held', 'Brass lantern', 'rare'], ['i7', 'held', 'Fishing rod', 'rare'], ['i8', 'held', 'Dice cup', 'rare'],
  ['i3', 'held', 'Travel lute', 'epic'], ['i9', 'held', 'Orb staff', 'epic'], ['i10', 'held', 'Spellbook', 'epic'],
  ['i4', 'held', 'Golden goblet', 'legendary'], ['i11', 'held', 'Dragon egg', 'legendary'], ['i12', 'held', 'Starlit wand', 'legendary'],
  ['c1', 'companion', 'Garden snail', 'common'], ['c5', 'companion', 'Field mouse', 'common'], ['c6', 'companion', 'Ladybug', 'common'],
  ['c2', 'companion', 'Pond frog', 'rare'], ['c7', 'companion', 'Hedgehog', 'rare'], ['c8', 'companion', 'Tabby cat', 'rare'],
  ['c3', 'companion', 'Barn owl', 'epic'], ['c9', 'companion', 'Little fox', 'epic'], ['c10', 'companion', "Will-o'-wisp", 'epic'],
  ['c4', 'companion', 'Dragonling', 'legendary'], ['c11', 'companion', 'Phoenix chick', 'legendary'], ['c12', 'companion', 'Moon cat', 'legendary'],
]
export const ITEMS: Item[] = RAW_ITEMS.map(([id, slot, name, rarity]) => ({ id, slot, name, rarity, price: RARITY[rarity].price }))
export const ITEM: Record<ItemCode, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

export type Look = Partial<Record<Slot, ItemCode>>

export const BARKEEP_ADDR = 'barkeep-of-the-taproom'
export const BARKEEP_LOOK: Look = { outfit: 'o1', held: 'i1' }

export const LINES = {
  sealed: "Your pick is sealed. Don't tell anyone, not even me.",
  result: (avg: string, target: string, name: string, pick: number) =>
    `The crowd averaged ${avg}. Two thirds of that is ${target}. ${name} sat closest with ${pick}.`,
  tie: 'Two regulars, one target. The prize splits.',
  cancel: 'Too few showed. Everyone gets their coins back, and the tavern takes nothing.',
  fee: 'The tavern keeps half a percent for the lamp oil.',
  streak: (weeks: number, bonus: number) => `${weeks} weeks running. Bonus per round: ${bonus}.`,
  risk: (time: string) => `Your streak ends in ${time}. Sit down for one round.`,
  freeze: 'A freeze kept your streak warm.',
}
