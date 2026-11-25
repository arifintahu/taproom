// Guided mode for a scenario: tracks the current step, advances when its `done` check passes,
// runs waiting steps on their own after a short pause, and performs a step on Next.

import { loadScenario, SCENARIO, type Ctx, type Scenario, type Step } from './scenarios'

export type Mode = 'guided' | 'free'

/** A waiting step (the clock moving) runs by itself after this long in guided mode. */
export const WAIT_MS = 1800

export class Guide {
  readonly sc: Scenario
  readonly ctx: Ctx
  mode: Mode
  step = 0
  private waitSince = 0
  private running = false
  private wallNow: () => number

  constructor(ctx: Ctx, sc: Scenario, mode: Mode, wallNow: () => number = Date.now) {
    this.ctx = ctx
    this.sc = sc
    this.mode = sc.steps.length ? mode : 'free'
    this.wallNow = wallNow
  }

  get count() { return this.sc.steps.length }
  get current(): Step | undefined { return this.sc.steps[this.step] }
  get finished() { return this.step >= this.count }

  /** The control to pulse for the current step, if any. */
  target(): string | undefined {
    const st = this.current
    if (this.mode !== 'guided' || !st?.target) return undefined
    return typeof st.target === 'function' ? st.target(this.ctx) : st.target
  }

  /** Advance past every step whose done check already holds. Returns true when the step changed. */
  check(): boolean {
    if (this.mode !== 'guided') return false
    const start = this.step
    while (this.current?.done?.(this.ctx)) {
      this.step++
      this.waitSince = 0
    }
    return this.step !== start
  }

  /** Next: perform the current step (or pass an info step), then advance as far as checks allow. */
  async next(): Promise<void> {
    const st = this.current
    if (!st || this.running) return
    this.running = true
    try {
      if (!st.done) {
        this.step++
      } else if (!st.done(this.ctx) && st.act) {
        await st.act(this.ctx)
        await this.ctx.session.refresh()
      }
      this.waitSince = 0
      this.check()
    } finally {
      this.running = false
    }
  }

  /** Called on every frame: a waiting step acts on its own after WAIT_MS. */
  async tick(): Promise<boolean> {
    const st = this.current
    if (this.mode !== 'guided' || !st?.wait || this.running || st.done?.(this.ctx)) return false
    const now = this.wallNow()
    if (!this.waitSince) {
      this.waitSince = now
      return false
    }
    if (now - this.waitSince < WAIT_MS) return false
    await this.next()
    return true
  }
}

/** A fresh scenario at step k: seed it, then replay the earlier steps' actions. */
export async function loadAt(id: string, mode: Mode, k = 0): Promise<Guide> {
  const ctx = await loadScenario(id)
  const g = new Guide(ctx, SCENARIO[id], mode)
  for (let i = 0; i < k && i < g.count; i++) {
    const st = g.sc.steps[i]
    if (st.act && !st.done?.(ctx)) {
      await st.act(ctx)
      await ctx.session.refresh()
    }
  }
  g.step = Math.min(k, g.count)
  return g
}
