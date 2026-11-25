# Taproom repo: notes for Claude

Taproom is a Gno.land hackathon entry (Gnome Tavern Hackathon): a pixel-art tavern where players play the 2/3 Game for a pot. This file covers the code in this repo. Gameplay and setup are in [README.md](README.md).

The rules and numbers live in the code: `web/src/game/constants.ts` and `rules.ts` for the client, `realm/taproom/taproom.gno` for the chain. Keep design notes, specs and plans out of this repo.

## Layout

| Path | What |
|---|---|
| `realm/` | A `gnowork.toml` workspace, so packages here import each other in tests |
| `realm/commitreveal/` | Gno package `gno.land/p/<owner>/commitreveal/v0`: commit-reveal sessions (windows, commits, reveals, who did not reveal). No coins, no global state. `example_test.gno` is the README sample |
| `realm/avatar/` | Gno package `gno.land/p/<owner>/avatar/v0`: `Render(addr, equipped [4]int)` SVG, `DataURI`, `Combo`, `ValidItem`. `layers.gno` is generated: run `python tools/pixelart/export_gno.py web/public/pixel realm/avatar/layers.gno` after any change to the layer art |
| `realm/sealedpoll/` | Gno realm `gno.land/r/<owner>/sealedpoll/v0`: sealed polls (`NewPoll`, `Vote`, `Open`, `Tally`, `Render`), a second realm on `commitreveal` showing the package is reusable. No coins |
| `realm/taproom/` | Gno realm. `taproom.gno` (engine, payouts, points, streak, cosmetics, leaderboard stats; each round's `Seal` is a `commitreveal.Session`), `views.gno` (JSON views for the UI), `board.gno` (leaderboards, `LeaderboardJSON`), `render.gno` (gnoweb pages with avatars), `*_test.gno` |
| `realm/scripts/` | Bash scripts that need the Gno toolchain: `test.sh`, `local-start.sh`, `local-fund.sh`, `local-bot.sh`, `local-probe.sh`, `local-stop.sh`, `testnet-deploy.sh` |
| `web/src/game/` | Pure logic: `rules.ts` (settle maths, streak), `constants.ts`, `selectors.ts` (blockers, Confirm rows), `room.ts`, `closeup.ts`, `panels.ts`, `avatar.ts`, `commit.ts` |
| `web/src/chain/` | `ChainClient` (`types.ts`); `mock/MockChain.ts`; `gno/` (`GnoChain`, `signers` for the dev key and Adena, `qeval` parsers, `mapping`; the Hall reads the realm's `LeaderboardJSON`); `config.ts` picks one from the URL |
| `web/src/state/` | `Session` store (snapshot, UI state, actions, Confirm-sheet tx flow), salt storage |
| `web/src/scene/`, `web/src/ui/` | Room and close-up scenes; HUD, windows, Confirm sheet, slate |
| `web/src/dev/` | Dev mode (`?dev`): `scenarios.ts` (S1-S13 with seeds, steps, `done` checks and `act`s), `guide.ts` (guided-step controller), `DevHost.tsx` and `DevBar.tsx` (toolbar). Lazy-loaded; players never download it |
| `web/screens/` | Playwright script that regenerates `media/*.png` |
| `tools/pixelart/` | Python generator for `web/public/pixel` (the project's own art) |
| `tools/verify/` | `verify-round.mjs`: standalone settle checker (plain Node, no dependencies, no code shared with the realm or web app); `verify-round.test.mjs` |

## Commands

Web (from `web/`): `pnpm test`, `pnpm lint`, `pnpm build`, `PW_CHANNEL=chrome pnpm test:e2e`, `PW_CHANNEL=chrome pnpm screenshots`.

Settle checker (from the repo root): `node --test tools/verify/verify-round.test.mjs`; against a chain: `node tools/verify/verify-round.mjs --all [--rpc URL] [--realm PATH]`.

Realm (needs the Gno toolchain v1.8: `gno`, `gnokey`, `gnodev`; the scripts look in `$GNO_HOME/bin`, default `~/.gno/bin`, then `PATH`):

```bash
bash realm/scripts/test.sh    # every package in the workspace
```

Deploy order matters: `commitreveal` before the realm that imports it (`local-start.sh` deploys `commitreveal` and `avatar`, then `taproom` and `sealedpoll`). A change to `commitreveal` needs a new package path on a public network, and the realm import must follow it.

Local chain: run `local-start.sh` in its own terminal or as a background task; it stays attached to `gnodev` until stopped. Then open `http://localhost:5173/?chain=local` (dev key) or `?chain=local&signer=adena`.

Testnet: `testnet-deploy.sh <key> simulate|broadcast` (Onyx by default). `?chain=onyx` reads Onyx and signs with Adena only. Every package path is versioned (`/v0`); a fix to a deployed package needs a new version path, and importers must follow it.

Definition of done: Vitest, lint, build and the Playwright tests pass, plus the Gno tests (and `gno lint`, `gno fmt`) when the realm changed, and the settle checker tests when settle rules or `RoundJSON` changed. Report real output.

## Rules for this code

- **Money and rules:** settle maths lives in one place, `web/src/game/rules.ts` `computeResult`, and must match `Settle` in the realm. `GnoChain` checks each settled round's winners, pot and fee against it and throws on a mismatch. Do not invent or change token or economic rules (fees, prizes, points, prices, caps) without the owner's confirmation.
- **Realm changes:** write the Gno test first, keep effects before transfers, and keep the invariants (credited + fee == pot, void rounds take no fee, points never decrease Lifetime, freezes stay 0..2).
- **Commit format:** `CommitHash(round, player, pick, salt)` = `sha256("<round>:<address>:<pick>:<salt>")`. Binding the round and player stops a copied hash from being opened by someone else (a copier could otherwise tie the winner and split the prize). `web/src/game/commit.ts` and `local-bot.sh` must use the same format. Reveal needs a salt of 16 to 128 visible ASCII characters (sealedpoll `Open`: at least 16); with 101 picks a short salt can be guessed from the hash. `RoundJSON` publishes each commit, and each salt once revealed, so `tools/verify` can re-check every reveal; if the settle rules or the JSON change, update the checker too.
- **Every write takes a direct wallet call** (`mustUser`: `IsUserCall()`, which is false for other realms and for `maketx run` scripts). Tests must call `testing.SetRealm(testing.NewUserRealm(...))` in the same function before a write; it has no effect when set in a helper such as `reset()`.
- **User text on Render pages is escaped** (sealedpoll `escape`) or not echoed (taproom not-found pages), so it cannot add links or headings.
- **No unbounded loops in calls or views.** Rounds live in an `avl.Tree`; the open-round cap uses a per-creator counter; Render uses an open-round index and the last 5 settled IDs; each board is a sorted `avl.Tree` (`boardIdx`) kept current by `reindex(addr)`. Any new code path that changes a board stat (points, net, distance, best streak, equipped items) must call `reindex`.
- **Every write shows the Confirm sheet** (action, amount, recipient, breakdown) before the wallet. New writes go through `Session.request`, which appends `ChainClient.networkRows` (gas fee and storage deposit; none on MockChain). A new write needs an entry in `FUNC_OF` and `GAS` in `GnoChain.ts`.
- **Avatar hash:** `avatar.Combo` and the web app's `addrHash` (`web/src/game/avatar.ts`) must stay identical, or a gnome looks different on chain and in the app; `avatar_test.gno` pins three addresses.
- **Guided targets:** a scenario step's `target` key must match a `data-tg` attribute on the control it points at; `e2e/dev.spec.ts` plays every scenario through the toolbar.
- **Accessibility bar:** every clickable is a real button, 44 px targets, visible focus ring, Escape closes the top window only, and reduced motion is honoured.
- **Chain safety:** do not send testnet or mainnet transactions, or post anywhere, unless the user asks. The dev-key signer must refuse any non-local RPC.
- **Commits:** Conventional Commits; commit and push only when asked.

## Gotchas learned the hard way

- Render pages run under the query gas limit (3B). One avatar costs about 100M gas (`DataURI`, base64 included), so a page shows at most 10 gnomes (`boardPageRows`, 10 seats per round). The avatar draws each run as a 1 px stroke (`M x y.5 h w`) from precomputed number strings; the earlier fill paths with `strconv` cost twice as much.
- `vm/qeval` output looks like `("…json…" string)`, `(0 int)`, `(5 int64)` and `("g1…" .uverse.address)`. The parsers in `chain/gno/qeval.ts` are pinned to these.
- `@gnolang/gno-js-client` needs a `Buffer` polyfill in the browser (`chain/gno/polyfill.ts`, loaded first). `GnoWallet.createRandom` needs Node's crypto, so the dev key uses Web Crypto plus `fromPrivateKey`. `GnoJSONRPCProvider` is built with the async `create()`. The client loads only when `?chain` is set, which keeps the main bundle near 340 KB.
- Adena (tested 2026-11-25) does not match its docs. `DoContract` success is `TRANSACTION_SUCCESS` with `data { hash (hex), Log, error, data }` and no block height. `ALREADY_CONNECTED` is a failure status that means connected. Adena's built-in network "Local" is chain `dev` at `http://127.0.0.1:26657`. It appears to charge its own fee estimate.
- Deploying the realm takes about 100M gas and an 8.0 GNOT storage deposit on local gnodev (`avatar`: 47M gas, 6.5 GNOT). With the board indexes, calls cost more: Join 14-22M, Reveal 12-18M, Settle 52M at 10 seats (1.4 GNOT storage); `GnoChain` gas limits follow these, and the signer offers gas wanted / 1000 ugnot as the fee. Joins, reveals and settles also pay storage deposits; the settler pays for writing other players' credits.
- `lib.sh` defaults `RPC` and `CHAIN` to the local chain, so a script that targets another network must set them *before* sourcing it. `testnet-deploy.sh` also checks the node's reported chain ID and refuses on a mismatch (an early version deployed to the local chain by mistake).
- Onyx uses the inert code-submission policy: `addpkg` parks a package (gas only); the package approver (gpao) typechecks and preprocesses it within a 10 s budget, and on a pass enables it about an hour later, when `init` runs with the creator as `OriginCaller` and the storage deposit is taken (capped by `-max-deposit`). A realm is checked only after its imports are enabled. While a package is inert its creator can replace it at the same path. Status: `vm/qpkgmeta_json` on chain, or gpas.onyx.testnets.gno.land.
- Files written by Python on Windows get CRLF, which breaks bash. `.gitattributes` forces LF; check scripts with `grep -c $'\r'`.
- If Playwright cannot find its browser build, `PW_CHANNEL=chrome` runs the tests on an installed Chrome.
