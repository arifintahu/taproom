# Taproom repo: notes for Claude

Taproom is a Gno.land hackathon entry (Gnome Tavern Hackathon): a pixel-art tavern where players play the 2/3 Game for a pot. This file covers the code in this repo. Gameplay and setup are in [README.md](README.md).

The rules and numbers live in the code: `web/src/game/constants.ts` and `rules.ts` for the client, `realm/taproom/taproom.gno` for the chain. Keep design notes, specs and plans out of this repo.

## Layout

| Path | What |
|---|---|
| `realm/` | A `gnowork.toml` workspace, so packages here import each other in tests |
| `realm/commitreveal/` | Gno package `gno.land/p/<owner>/commitreveal`: commit-reveal sessions (windows, commits, reveals, who did not reveal). No coins, no global state. `example_test.gno` is the README sample |
| `realm/sealedpoll/` | Gno realm `gno.land/r/<owner>/sealedpoll`: sealed polls (`NewPoll`, `Vote`, `Open`, `Tally`, `Render`), a second realm on `commitreveal` showing the package is reusable. No coins |
| `realm/taproom/` | Gno realm. `taproom.gno` (engine, payouts, points, streak, cosmetics; each round's `Seal` is a `commitreveal.Session`), `views.gno` (JSON views for the UI), `*_test.gno` |
| `realm/scripts/` | Bash scripts that need the Gno toolchain: `test.sh`, `local-start.sh`, `local-fund.sh`, `local-bot.sh`, `local-probe.sh`, `local-stop.sh` |
| `web/src/game/` | Pure logic: `rules.ts` (settle maths, streak), `constants.ts`, `selectors.ts` (blockers, Confirm rows), `room.ts`, `closeup.ts`, `panels.ts`, `hall.ts`, `avatar.ts`, `commit.ts` |
| `web/src/chain/` | `ChainClient` (`types.ts`); `mock/MockChain.ts`; `gno/` (`GnoChain`, `signers` for the dev key and Adena, `qeval` parsers, `mapping`); `config.ts` picks one from the URL |
| `web/src/state/` | `Session` store (snapshot, UI state, actions, Confirm-sheet tx flow), salt storage |
| `web/src/scene/`, `web/src/ui/` | Room and close-up scenes; HUD, windows, Confirm sheet, slate |
| `web/src/dev/` | Dev mode (`?dev`): `scenarios.ts` (S1-S13 with seeds, steps, `done` checks and `act`s), `guide.ts` (guided-step controller), `DevHost.tsx` and `DevBar.tsx` (toolbar). Lazy-loaded; players never download it |
| `web/screens/` | Playwright script that regenerates `media/*.png` |
| `tools/pixelart/` | Python generator for `web/public/pixel` (the project's own art) |

## Commands

Web (from `web/`): `pnpm test`, `pnpm lint`, `pnpm build`, `PW_CHANNEL=chrome pnpm test:e2e`, `PW_CHANNEL=chrome pnpm screenshots`.

Realm (needs the Gno toolchain v1.8: `gno`, `gnokey`, `gnodev`; the scripts look in `$GNO_HOME/bin`, default `~/.gno/bin`, then `PATH`):

```bash
bash realm/scripts/test.sh    # every package in the workspace
```

Deploy order matters: `commitreveal` before the realm that imports it (`local-start.sh` deploys `commitreveal`, then `taproom` and `sealedpoll`). A change to `commitreveal` needs a new package path on a public network, and the realm import must follow it.

Local chain: run `local-start.sh` in its own terminal or as a background task; it stays attached to `gnodev` until stopped. Then open `http://localhost:5173/?chain=local` (dev key) or `?chain=local&signer=adena`.

Definition of done: Vitest, lint, build and the Playwright tests pass, plus the Gno tests when the realm changed. Report real output.

## Rules for this code

- **Money and rules:** settle maths lives in one place, `web/src/game/rules.ts` `computeResult`, and must match `Settle` in the realm. `GnoChain` checks each settled round's winners, pot and fee against it and throws on a mismatch. Do not invent or change token or economic rules (fees, prizes, points, prices, caps) without the owner's confirmation.
- **Realm changes:** write the Gno test first, keep effects before transfers, and keep the invariants (credited + fee == pot, void rounds take no fee, points never decrease Lifetime, freezes stay 0..2).
- **Every write shows the Confirm sheet** (action, amount, recipient, breakdown) before the wallet. New writes go through `Session.request`.
- **Guided targets:** a scenario step's `target` key must match a `data-tg` attribute on the control it points at; `e2e/dev.spec.ts` plays every scenario through the toolbar.
- **Accessibility bar:** every clickable is a real button, 44 px targets, visible focus ring, Escape closes the top window only, and reduced motion is honoured.
- **Chain safety:** do not send testnet or mainnet transactions, or post anywhere, unless the user asks. The dev-key signer must refuse any non-local RPC.
- **Commits:** Conventional Commits; commit and push only when asked.

## Gotchas learned the hard way

- `vm/qeval` output looks like `("…json…" string)`, `(0 int)`, `(5 int64)` and `("g1…" .uverse.address)`. The parsers in `chain/gno/qeval.ts` are pinned to these.
- `@gnolang/gno-js-client` needs a `Buffer` polyfill in the browser (`chain/gno/polyfill.ts`, loaded first). `GnoWallet.createRandom` needs Node's crypto, so the dev key uses Web Crypto plus `fromPrivateKey`. `GnoJSONRPCProvider` is built with the async `create()`. The client loads only when `?chain` is set, which keeps the main bundle near 340 KB.
- Adena (tested 2026-11-25) does not match its docs. `DoContract` success is `TRANSACTION_SUCCESS` with `data { hash (hex), Log, error, data }` and no block height. `ALREADY_CONNECTED` is a failure status that means connected. Adena's built-in network "Local" is chain `dev` at `http://127.0.0.1:26657`. It appears to charge its own fee estimate.
- Deploying the realm takes about 63M gas and a 3.9 GNOT storage deposit on local gnodev. Joins, reveals and settles also pay storage deposits; the settler pays for writing other players' credits.
- Files written by Python on Windows get CRLF, which breaks bash. `.gitattributes` forces LF; check scripts with `grep -c $'\r'`.
- If Playwright cannot find its browser build, `PW_CHANNEL=chrome` runs the tests on an installed Chrome.
