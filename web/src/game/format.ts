import { UGNOT_PER_GNOT } from './constants'
import type { Ugnot } from './types'

/** ugnot to a GNOT string without trailing zeros: 2985000 -> "2.985". */
export const fmtG = (u: Ugnot) => String(Math.round(u) / UGNOT_PER_GNOT)
/** Two decimals at most: 23.333 -> "23.33". */
export const fmtN = (x: number) => String(Math.round(x * 100) / 100)

const pad = (n: number) => String(n).padStart(2, '0')

/** Countdown in seconds: "1:05" or "2:00:05". */
export function dur(secs: number): string {
  const t = Math.max(0, Math.ceil(secs))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Short duration: "2d 4h", "3h 5m", "12m". */
export function human(secs: number): string {
  const m = Math.floor(Math.max(0, secs) / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d ${h % 24}h`
  if (h >= 1) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`
  return `${Math.max(1, m)}m`
}

/** Long duration for sentences: "20 hours", "1 day 3 hours", "5 minutes". */
export function humanLong(secs: number): string {
  const s = Math.max(0, secs)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`
  if (d) return plural(d, 'day') + (h ? ' ' + plural(h, 'hour') : '')
  if (h) return plural(h, 'hour') + (m ? ` ${m} min` : '')
  return `${Math.max(1, m)} minutes`
}

/** "g1qx7...m4k2" stays; long bech32 addresses shorten to "g1abcd…wxyz". */
export function shortAddr(a: string): string {
  return a.length > 16 && !a.includes('...') ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

/** Long hex (tx hash) for display: first 6 and last 6 characters, "abcdef…ababab". */
export const shortHash = (h: string) => (h.length > 14 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h).toLowerCase()
