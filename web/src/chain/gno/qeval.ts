// Parsers for vm/qeval output. Formats seen on gno v1.8.0 (local gnodev, 2026-11-25):
//   ("[{\"id\":0}]" string)   (0 int)   (2985000 int64)   ("g1..." .uverse.address)

/** The Go-quoted string of a `("..." string)` result, unquoted. */
export function qString(out: string): string {
  const m = out.trim().match(/^\((".*") string\)$/s)
  if (!m) throw new Error(`unexpected qeval string: ${out.slice(0, 80)}`)
  // Go's %q escaping for this ASCII JSON payload is a subset of JSON string escaping.
  return JSON.parse(m[1]) as string
}

/** JSON returned as a Gno string. */
export const qJSON = <T>(out: string): T => JSON.parse(qString(out)) as T

/** `(123 int)` or `(-4 int64)`. */
export function qInt(out: string): number {
  const m = out.trim().match(/^\((-?\d+) u?int(?:64|32)?\)$/)
  if (!m) throw new Error(`unexpected qeval int: ${out.slice(0, 80)}`)
  const n = Number(m[1])
  if (!Number.isSafeInteger(n)) throw new Error(`qeval int out of range: ${m[1]}`)
  return n
}

/** `("g1..." .uverse.address)` or `(g1... std.Address)`. */
export function qAddress(out: string): string {
  const m = out.match(/g1[0-9a-z]{38}/)
  if (!m) throw new Error(`unexpected qeval address: ${out.slice(0, 80)}`)
  return m[0]
}

/** A Gno string literal for a qeval expression argument (addresses, salts). */
export const gnoStr = (s: string) => JSON.stringify(s)
