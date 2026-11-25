// Tests for the standalone settle checker: node --test tools/verify
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { checkRound } from './verify-round.mjs'

const sha = (s) => createHash('sha256').update(s).digest('hex')
const SALT = 'salt-0123456789abcdef'

// A settled round as RoundJSON returns it. picks: null = sealed but never revealed.
function round(id, picks, extra = {}) {
  const entries = picks.map((pick, i) => {
    const addr = `g1player${i}`
    const salt = `${SALT}-${i}`
    const revealed = pick !== null
    return {
      addr, commit: sha(`${id}:${addr}:${pick ?? 50}:${salt}`), revealed,
      pick: revealed ? pick : null, salt: revealed ? salt : null, bonus: 4,
    }
  })
  return { id, num: 2, den: 3, settled: true, pot: 1_000_000 * picks.length, fee: 0, winners: [], entries, ...extra }
}

test('a completed round: winner, fee and split are recomputed', () => {
  // picks 10, 50, 20: average 26.67, target 17.78; 20 is closest
  const r = round(4, [10, 50, 20], { fee: 15_000, winners: ['g1player2'] })
  const res = checkRound(r)
  assert.equal(res.ok, true, res.problems.join('; '))
  assert.equal(res.kind, 'completed')
  assert.deepEqual(res.payouts, { g1player2: 2_985_000 })
  assert.equal(res.target, '17.78')
})

test('a tie splits the prize; the remainder goes to the first winner in join order', () => {
  // four seats, three tied on 10: prize 3,980,000 / 3 = 1,326,666 r 2
  const r = round(7, [10, 10, 10, 90], { fee: 20_000, winners: ['g1player0', 'g1player1', 'g1player2'] })
  const res = checkRound(r)
  assert.equal(res.ok, true, res.problems.join('; '))
  assert.deepEqual(res.payouts, { g1player0: 1_326_668, g1player1: 1_326_666, g1player2: 1_326_666 })
  const paid = Object.values(res.payouts).reduce((a, b) => a + b, 0)
  assert.equal(paid + res.fee, r.pot)
})

test('fewer than two reveals: everyone is refunded and no fee is taken', () => {
  const res = checkRound(round(2, [33, null, null]))
  assert.equal(res.ok, true, res.problems.join('; '))
  assert.equal(res.kind, 'void')
  assert.deepEqual(res.payouts, { g1player0: 1_000_000, g1player1: 1_000_000, g1player2: 1_000_000 })
})

test('a non-revealer forfeits into the pot', () => {
  const r = round(3, [10, 50, null], { fee: 15_000, winners: ['g1player0'] })
  const res = checkRound(r)
  assert.equal(res.ok, true, res.problems.join('; '))
  assert.deepEqual(res.payouts, { g1player0: 2_985_000 })
})

test('flags a wrong winner, a wrong fee and a pick that does not open its commit', () => {
  const wrongWinner = checkRound(round(4, [10, 50, 20], { fee: 15_000, winners: ['g1player0'] }))
  assert.equal(wrongWinner.ok, false)
  assert.match(wrongWinner.problems.join(), /winners/)

  const wrongFee = checkRound(round(4, [10, 50, 20], { fee: 16_000, winners: ['g1player2'] }))
  assert.match(wrongFee.problems.join(), /fee/)

  const tampered = round(4, [10, 50, 20], { fee: 15_000, winners: ['g1player2'] })
  tampered.entries[1].pick = 49 // the chain says 49 but the commit sealed 50
  assert.match(checkRound(tampered).problems.join(), /does not open its commit/)

  const voidWithFee = checkRound(round(2, [33, null], { fee: 10_000 }))
  assert.match(voidWithFee.problems.join(), /void round/)

  const badPot = checkRound(round(4, [10, 50, 20], { fee: 15_000, winners: ['g1player2'], pot: 2_000_000 }))
  assert.match(badPot.problems.join(), /pot/)
})

test('an open round is reported, not judged', () => {
  const res = checkRound(round(9, [10, null], { settled: false }))
  assert.equal(res.kind, 'open')
  assert.equal(res.ok, true)
})
