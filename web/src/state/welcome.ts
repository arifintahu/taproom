// First visit on a real chain: the welcome sheet offers practice (no wallet) or the testnet. Shown once per browser.

const KEY = 'taproom.welcomed'

export function welcomeSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // no storage: never nag
  }
}

export function markWelcomed() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: the sheet may show again next visit
  }
}

/** The hosted site defaults to a real chain; only there does practice mode need a way back. */
export const HOSTED_REAL = !!import.meta.env.VITE_DEFAULT_CHAIN && import.meta.env.VITE_DEFAULT_CHAIN !== 'mock'
