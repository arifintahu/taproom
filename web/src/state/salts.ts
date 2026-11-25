// Salt storage: a lost salt means a forfeited deposit, so every sealed pick is kept locally.

export interface SaltRecord {
  realm: string
  roundId: number
  address: string
  pick: number
  salt: string
}

export interface SaltStore {
  save(rec: SaltRecord): void
  get(realm: string, roundId: number, address: string): SaltRecord | undefined
  all(): SaltRecord[]
}

const key = (r: string, id: number, a: string) => `${r}|${id}|${a}`

export class MemorySaltStore implements SaltStore {
  private m = new Map<string, SaltRecord>()
  save(rec: SaltRecord) { this.m.set(key(rec.realm, rec.roundId, rec.address), rec) }
  get(realm: string, roundId: number, address: string) { return this.m.get(key(realm, roundId, address)) }
  all() { return [...this.m.values()] }
}

export class LocalSaltStore implements SaltStore {
  private storageKey: string
  constructor(storageKey = 'taproom.picks.v1') {
    this.storageKey = storageKey
  }
  private read(): SaltRecord[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as SaltRecord[]
    } catch {
      return []
    }
  }
  save(rec: SaltRecord) {
    const list = this.read().filter((r) => key(r.realm, r.roundId, r.address) !== key(rec.realm, rec.roundId, rec.address))
    list.push(rec)
    localStorage.setItem(this.storageKey, JSON.stringify(list))
  }
  get(realm: string, roundId: number, address: string) {
    return this.read().find((r) => key(r.realm, r.roundId, r.address) === key(realm, roundId, address))
  }
  all() { return this.read() }
}
