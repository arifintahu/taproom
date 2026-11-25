// @gnolang/gno-js-client and tm2-js-client use Node's Buffer; browsers need it on globalThis.
import { Buffer } from 'buffer'

const g = globalThis as unknown as { Buffer?: typeof Buffer }
if (!g.Buffer) g.Buffer = Buffer
