#!/usr/bin/env node
// Standalone settle checker for the Taproom realm. It reads rounds with one read-only query each
// (RoundJSON through the node's vm/qeval) and recomputes every result from the published rules,
// sharing no code with the realm or the web app:
//
//   - each revealed pick opens its commit: sha256("<round>:<address>:<pick>:<salt>") == commit
//   - fewer than 2 reveals: void, every seat refunded, no fee
//   - otherwise the target is num/den of the average of revealed picks; the winners are the picks
//     closest to it (|den*n*pick - num*sum| is smallest, integer maths), in join order
//   - fee = floor(pot * 50 / 10000); the rest splits evenly, the remainder to the first winner
//   - the pot equals 1 GNOT per seat, and payouts plus the fee equal the pot
//
// Usage:
//   node tools/verify/verify-round.mjs <round-id> [--rpc URL] [--realm PATH]
//   node tools/verify/verify-round.mjs --all [--rpc URL] [--realm PATH]
// Defaults: --rpc http://127.0.0.1:26657, --realm gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom/v2
// Exit code 0 when every checked round matches, 1 when any does not, 2 on a usage or network error.

import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const ENTRY_FEE = 1_000_000 // ugnot per seat
const FEE_BPS = 50n
const BPS_TOTAL = 10_000n

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

/** Recomputes one round. Returns { ok, kind, problems, payouts, fee, target }. */
export function checkRound(r) {
  const problems = []
  const entries = r.entries ?? []
  const revealed = entries.filter((e) => e.revealed)

  for (const e of revealed) {
    if (!Number.isInteger(e.pick) || e.pick < 0 || e.pick > 100) problems.push(`${e.addr}: pick ${e.pick} is not 0..100`)
    if (typeof e.salt !== 'string' || sha256(`${r.id}:${e.addr}:${e.pick}:${e.salt}`) !== e.commit) {
      problems.push(`${e.addr}: revealed pick ${e.pick} does not open its commit`)
    }
  }
  if (r.pot !== ENTRY_FEE * entries.length) problems.push(`pot ${r.pot} is not 1 GNOT per seat (${entries.length} seats)`)

  if (!r.settled) return { ok: problems.length === 0, kind: 'open', problems, payouts: {}, fee: 0, target: null }

  const payouts = {}
  const add = (a, amt) => { payouts[a] = (payouts[a] ?? 0) + amt }

  if (revealed.length < 2) {
    for (const e of entries) add(e.addr, ENTRY_FEE)
    if (r.fee !== 0) problems.push(`void round took a fee of ${r.fee}`)
    if ((r.winners ?? []).length) problems.push(`void round lists winners ${r.winners}`)
    return { ok: problems.length === 0, kind: 'void', problems, payouts, fee: 0, target: null }
  }

  const n = BigInt(revealed.length)
  const num = BigInt(r.num)
  const den = BigInt(r.den)
  const sum = revealed.reduce((s, e) => s + BigInt(e.pick), 0n)
  const dist = (e) => { const d = den * n * BigInt(e.pick) - num * sum; return d < 0n ? -d : d }
  const best = revealed.reduce((m, e) => (dist(e) < m ? dist(e) : m), dist(revealed[0]))
  const winners = revealed.filter((e) => dist(e) === best).map((e) => e.addr) // join order

  const pot = BigInt(r.pot)
  const fee = (pot * FEE_BPS) / BPS_TOTAL
  const prize = pot - fee
  const k = BigInt(winners.length)
  const share = prize / k
  winners.forEach((w, i) => add(w, Number(i === 0 ? share + (prize - share * k) : share)))

  if (JSON.stringify(winners) !== JSON.stringify(r.winners ?? [])) {
    problems.push(`winners on chain ${JSON.stringify(r.winners)} but the rules give ${JSON.stringify(winners)}`)
  }
  if (BigInt(r.fee) !== fee) problems.push(`fee on chain ${r.fee} but the rules give ${fee}`)
  const paid = Object.values(payouts).reduce((a, b) => a + BigInt(b), 0n)
  if (paid + fee !== pot) problems.push(`payouts ${paid} + fee ${fee} != pot ${pot}`)

  // target = num * sum / (den * n), shown to two decimals
  const t100 = (num * sum * 100n * 10n / (den * n) + 5n) / 10n
  const target = `${t100 / 100n}.${String(t100 % 100n).padStart(2, '0')}`
  return { ok: problems.length === 0, kind: 'completed', problems, payouts, fee: Number(fee), target }
}

// ---------- reading the chain ----------

async function qeval(rpc, realm, expr) {
  const hex = Buffer.from(`${realm}.${expr}`).toString('hex')
  const res = await fetch(`${rpc.replace(/\/$/, '')}/abci_query?path=%22vm/qeval%22&data=0x${hex}`)
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const base = (await res.json()).result?.response?.ResponseBase
  if (!base || base.Error) throw new Error(`query failed: ${base?.Log?.split('\n')[1] ?? 'no response'}`)
  return Buffer.from(base.Data, 'base64').toString('utf8')
}

// qeval prints a string as ("..." string) and an int as (5 int)
const asString = (out) => JSON.parse(out.slice(1, out.lastIndexOf(' string)')))
const asInt = (out) => Number(/^\((-?\d+) int\)/.exec(out)?.[1] ?? NaN)

const gnot = (u) => `${(u / 1e6).toFixed(6).replace(/\.?0+$/, '')} GNOT`

function report(r, res) {
  const head = `round ${r.id}: ${res.kind}`
  if (res.kind === 'open') return `${head} (${r.entries.length} seats, not settled yet)${res.ok ? '' : ' MISMATCH'}`
  const lines = [`${head}${res.target ? `, target ${res.target}` : ''}, pot ${gnot(r.pot)}, fee ${gnot(res.fee)}`]
  for (const [a, amt] of Object.entries(res.payouts)) lines.push(`  ${a} receives ${gnot(amt)}`)
  lines.push(res.ok ? '  OK: matches the rules' : res.problems.map((p) => `  MISMATCH: ${p}`).join('\n'))
  return lines.join('\n')
}

async function main(argv) {
  const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def }
  const rpc = opt('--rpc', 'http://127.0.0.1:26657')
  const realm = opt('--realm', 'gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom/v2')
  const id = argv.find((a, i) => /^\d+$/.test(a) && !['--rpc', '--realm'].includes(argv[i - 1]))
  if (!id && !argv.includes('--all')) {
    console.error('usage: verify-round.mjs <round-id> | --all [--rpc URL] [--realm PATH]')
    return 2
  }
  let ids = [Number(id)]
  if (argv.includes('--all')) {
    const count = asInt(await qeval(rpc, realm, 'RoundCount()'))
    ids = [...Array(count).keys()]
  }
  let bad = 0
  for (const i of ids) {
    const r = JSON.parse(asString(await qeval(rpc, realm, `RoundJSON(${i})`)))
    const res = checkRound(r)
    if (!res.ok) bad++
    console.log(report(r, res))
  }
  console.log(bad ? `${bad} of ${ids.length} rounds do not match` : `all ${ids.length} rounds match the rules`)
  return bad ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { console.error(err.message); process.exit(2) })
}
