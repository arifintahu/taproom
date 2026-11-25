# Taproom

A pixel-art tavern of short mind games on [Gno.land](https://gno.land). Players sit at a table, seal a number, and the one closest to two thirds of the crowd's average takes the pot. Every place in the room is a feature: the tables are games, the hearth keeps your weekly streak, the notice board holds the leaderboards, and the tailor sells costumes for your gnome.

Taproom is an entry for the Gnome Tavern Hackathon. It is a community project with no official link to Gno.land or its team.

![The taproom: tables, hearth, barkeep and wardrobe](media/room.png)

## Gameplay

### The 2/3 Game

Each table runs one round of the classic "guess two thirds of the average" game, with real coins at stake and nothing hidden from the chain.

1. **Seal.** Pay the 1 GNOT entry fee and write a whole number from 0 to 100 on your slip. Only a hash of your pick goes on chain (`sha256("<pick>:<salt>")`), so nobody can see it, not even the tavern.
2. **Reveal.** When the hourglass turns, break your seal. The realm checks your pick against the hash. Miss the reveal window and your deposit stays in the pot.
3. **Settle.** When the reveal window closes, anyone can settle the round, visitors included. The winner is the revealed pick closest to two thirds of the average of all revealed picks.
4. **Claim.** Winners claim their share. Payouts are pull-based: settling credits a balance, and claiming sends the coins.

![A table during the commit window: three sealed slips and the pot](media/table.png)

### The rules in numbers

| Rule | Value |
|---|---|
| Entry fee | 1 GNOT per player |
| Players per table | 2 to 10 (best with 3 or more) |
| Tavern fee | 0.5% of the pot, only on completed rounds |
| Ties | The prize splits evenly; the remainder goes to the first winner in join order |
| No reveal | The deposit stays in the pot for the winner |
| Fewer than 2 reveals | The round is cancelled and everyone is refunded in full, with no fee |
| Windows | Quick 2 + 2 minutes, Standard 30 + 30 minutes, Daily 12 + 12 hours |
| Open tables | Up to 3 per player at a time |

With exactly two players the lower pick always wins (two thirds of the average is one third of the sum), and the table says so. Groups that play together drift toward 0 over time, which is part of the fun of guessing the crowd.

![After settle: the chalk tally shows the average, the target and the winner](media/result.png)

### Before you sign

Every action that writes to the chain first opens the tavern's Confirm sheet: the action, the amount, the recipient realm, and for a join the pot, the 0.5% fee and what the winner would receive. Only **Approve and sign** passes it to the wallet.

![The Confirm sheet before joining a table](media/confirm.png)

### Points, ranks and the weekly streak

- **Points:** 10 for revealing in a completed round, 30 for a win, plus your streak bonus. Points are cosmetic: they cannot be traded and never change who wins. Void rounds pay no points.
- **Ranks** by lifetime points: Newcomer 0, Regular 100, Sharp 500, Oracle 1500, Legend 4000.
- **Weekly streak:** reveal in at least one round each week (weeks start Monday 00:00 UTC). The bonus per round is 4 points per streak week, up to 20.
- **Ember jars (streak freezes):** 40 points each, at most 2. Each covers one missed week automatically. Miss more weeks than you hold and the streak resets, using up every jar.

![My Regular: rank, points, streak, freezes and the owner's fee panel](media/regular.png)

### The tailor's wardrobe

Spend points on 48 items across four slots (hat, outfit, held item, companion), from Common (40 points) to Legendary (1000 points), and on table skins that everyone at your table sees. The Hall shows leaderboards for net coins, sharpest guesses, longest streak and points, plus a gallery sorted by style.

![The tailor's wardrobe](media/shop.png)

### Practice first

The Barkeep runs a free practice round against five scripted regulars: no wallet, no coins, about 20 seconds, ending with the same chalk tally as a real round.

<img src="media/mobile.png" alt="Taproom on a 375 px phone screen" width="260">

On narrow screens the room scrolls sideways and the Places row below it reaches every destination. Every place in the room is a real button, so the whole game works with a keyboard and a screen reader. Reduce motion turns the fire, flips and pulses into fades.

## How it is built

```
taproom/
  realm/commitreveal/  Gno package: the commit-reveal lifecycle for any sealed choice (importable)
  realm/avatar/        Gno package: the pixel gnome as SVG, with equipped items (importable)
  realm/taproom/       Gno realm: rounds, stakes, payouts, points, streaks, freezes, cosmetics, JSON views
  realm/sealedpoll/    Gno realm: sealed polls, a second realm built on commitreveal
  realm/scripts/       local gnodev chain: start, deploy, fund test keys, play scripted regulars
  web/             Vite + React + TypeScript app
    src/game/      rules and settle maths, streak, catalogue, avatars, selectors, scene layout
    src/chain/     ChainClient interface: MockChain (scenarios) and GnoChain (qeval reads, wallet signers)
    src/scene/     the room and the table close-up, drawn as DOM layers with real buttons
    src/ui/        HUD, Barkeep, windows, Confirm sheet, chalk slate
    src/dev/       dev mode: scenarios S1-S13, guided steps and the simulation toolbar
  tools/pixelart/  the Python generator for all the pixel art in web/public/pixel
  media/           README screenshots (regenerate with pnpm screenshots)
```

- **Realm:** `gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom`. Each round runs its sealed picks on `commitreveal`; the realm adds integer settle maths (`|3 * n * pick - 2 * sum|`), pull payments with effects before transfers, and a fee recipient that can only withdraw accrued fees. Read views return JSON for the web app.
- **Web app:** one `ChainClient` interface with two implementations. `MockChain` mirrors the realm in memory for the demo and the tests. `GnoChain` reads with `vm/qeval` and signs through Adena, or through a throwaway key on a local chain.
- **Time:** the realm uses block time. Gno has no scheduled execution, so streaks are evaluated lazily and anyone can settle.

## commitreveal: sealed choices for any realm

`gno.land/p/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/commitreveal` runs the whole commit-reveal lifecycle so a realm only writes its own rules: games with secret picks, sealed-bid auctions, private votes. A session holds the commit and reveal windows, accepts one hash per address, checks each reveal against its hash, and reports who opened what and who never revealed. It holds no coins and no global state; the importing realm stores the session and passes the block time.

```go
import "gno.land/p/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/commitreveal"

poll := commitreveal.New(now, 3600, 3600) // one hour to vote, one hour to open

// voting: only a hash goes on chain; the client keeps value and salt
err := poll.Commit(now, voter, hash)      // hash = commitreveal.Hash("yes", salt), computed off-chain

// opening, in the reveal window
err = poll.Reveal(now, voter, "yes", salt)

for _, o := range poll.Revealed() { // opened values, in commit order
	count(o.Who, o.Value)
}
late := poll.Unrevealed() // committed but never opened
```

The API: `New`, `Phase` (commit, reveal, closed), `Commit`, `Reveal`, `Has`, `Count`, `IsRevealed`, `Value`, `Players`, `Revealed`, `Unrevealed`, plus `Hash` and `Verify`. Errors are exported values (`ErrCommitClosed`, `ErrMismatch`, ...). The shortest example is `realm/commitreveal/example_test.gno`.

`realm/sealedpoll` (`gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/sealedpoll`) is a second realm built on the package, in about 200 lines. Anyone opens a question with 2 to 8 options (`NewPoll`), voters seal a choice (`Vote` with `commitreveal.Hash(option, salt)`), then open it (`Open`). `Tally` returns the counts as JSON, and `Render` lists every poll with its results and the number of sealed votes never opened. It holds no coins: every window, vote and reveal rule comes from `commitreveal`.

## avatar: the same gnome on chain

`gno.land/p/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/avatar` draws a player's gnome as SVG, matching the web app: a base gnome picked from the address (8 combinations of skin, beard and cap colour) with up to four equipped items layered on top.

```go
svg := avatar.Render(addr, [4]int{107, 201, 0, 403}) // hat, outfit, held item, companion; 0 = none
uri := avatar.DataURI(addr, equipped)               // data:image/svg+xml;base64,... for an image tag
```

The Taproom realm exposes it as `AvatarSVG(addr)`, drawn with the items the player has equipped. The art is stored compactly in `realm/avatar/layers.gno` (about 25 KB for 48 items and the base gnomes): each layer is a palette plus colour runs, and bodies, heads and caps share one layout across their colour variants. `tools/pixelart/export_gno.py` generates that file from the same layer art the web app uses and checks that every layer decodes back to its exact pixels.

## Leaderboards and pages on gno.land

The realm keeps leaderboard stats on each player (net coins, wins, average distance to the target, best weekly streak) and ranks five boards: points, net coins, sharpest guesses, longest streak and style (the rarity of the items worn). `LeaderboardJSON(board, limit)` returns the top rows, at most 50, with every stat in each row.

`Render` turns the realm into a small site on gnoweb, with each player's gnome drawn by the `avatar` package:

| Path | Page |
|---|---|
| `taproom` | Open tables, recent results and the top 5 by points |
| `taproom:board/<points|net|sharp|streak|style>` | One board, top 10 |
| `taproom:round/<id>` | Phase, result, target, and every seat with its pick and status |
| `taproom:player/<address>` | Rank, points, streak, wins, net coins, average distance, style |

Each gnome costs about 100M gas to draw, and a page render may use 3B, so a page shows at most 10 of them.

## Run it

Requirements: Node (tested with 24) and pnpm 9. Realm work needs the Gno toolchain (v1.8).

```bash
cd web
pnpm install
pnpm dev                  # http://localhost:5173, runs on MockChain
```

- `?dev` opens dev mode, a toolbar for demos and judging. Pick one of 18 scenarios (first visit, win, lose, forfeit, cancelled round, tie, two players, streak at risk, shop, six wallet errors, judge view, fee transparency, owner view). In Guided mode the toolbar shows each step, pulses the control to press, and runs waiting steps by itself; Next performs the step for you. It also moves the clock (+10 s, skip to reveal or settle, jump a week), pauses or speeds time 10x, simulates 375, 768 and 1280 px screens, and toggles reduced motion. `?dev&scn=s8&mode=free` opens a scenario without guidance.
- `?chain=local` plays on a local gnodev chain with a throwaway key kept in the browser; it signs only on `127.0.0.1`.
- `?chain=local&signer=adena` plays on the local chain with the Adena wallet (Adena's built-in "Local" network).

Local chain:

```bash
bash realm/scripts/local-start.sh             # starts gnodev, deploys the packages and both realms; keep it running
bash realm/scripts/local-fund.sh <g1address>  # sends 100 test GNOT from a premined test key
bash realm/scripts/local-bot.sh join p2 0 33  # another regular joins round 0 with pick 33
bash realm/scripts/local-stop.sh
```

## Tests

```bash
bash realm/scripts/test.sh    # Gno tests: commitreveal (7), avatar (6), the realm (23), sealedpoll (2)
cd web
pnpm test                     # Vitest: rules, settle invariants, scenarios S1-S13, chain adapters (81)
pnpm test:e2e                 # Playwright: room, full round, Confirm sheet paths, shop, practice (8)
pnpm lint && pnpm build
```

Settle invariants are checked on 500 random rounds: credited amounts plus the fee always equal the pot, and void rounds never take a fee.

## Status and known limits

- Played end to end (open, join, reveal, settle, claim) on a local gnodev chain, with the throwaway key and with the Adena extension. Not yet deployed to the public testnet.
- Joining, revealing and settling also cost gas and a storage deposit. The Confirm sheet does not show these network costs yet.
- A late revealer can see earlier reveals and choose to forfeit; the deposit is the price. One person with several wallets can skew the average; each wallet pays its own entry.
- Games with a pot can fall under gambling rules in some countries. Taproom runs on testnet, where coins have no value.

## License

Not chosen yet.
