# Security

Taproom holds player deposits in a Gno realm on a testnet. This file lists what has been reviewed, what was found, and what is accepted by design. The game rules are in the [README](README.md).

## Reporting

Please open a [GitHub security advisory](https://github.com/arifintahu/taproom/security/advisories/new) rather than a public issue. Include the realm path, the function, and the calls that show the problem.

## What the realm guarantees

These hold in every version since `taproom/v1` and are covered by the Gno tests in `realm/taproom/`:

- **Every pot is paid out exactly.** On a completed round, the credits plus the 0.5% fee equal the pot, and the remainder of a tied split goes to the first winner in join order. A void round (fewer than 2 reveals) refunds every seat its 1 GNOT and takes no fee.
- **The realm can always pay.** The only accounted inflow is `Join`, which takes exactly 1,000,000 ugnot and nothing else. The only outflows are `Claim` and `WithdrawFees`. Both set the balance to zero before sending, so a claim cannot be repeated.
- **Picks are bound to the player and round.** A commit is `sha256("<round>:<address>:<pick>:<salt>")`, so a copied commit cannot be revealed by anyone else or reused in another round.
- **Exact integer maths.** The winner minimises `|den * n * pick - num * sum|` with no division, and it cannot overflow at 10 seats.
- **Windows do not overlap.** Join runs while `t < commitEnd`, Reveal while `commitEnd <= t < revealEnd`, and Settle when `t >= revealEnd`. A round settles once. An empty or one-seat round settles as void.
- **Every write except Settle is a direct wallet call** (`IsUserCall`). This blocks one script from taking several seats with one payment.
- **Bounded work.** A round has at most 10 seats, each board at most 50 rows, and each Render page at most 10 avatars. No call or view loops over all players or rounds.

## Reviews

| Date | Version | Scope | Result |
|---|---|---|---|
| 2026-11-25 | `taproom/v0` | realm, `commitreveal`, `sealedpoll` | 1 critical finding (several seats for one payment from a script), blocked by `IsUserCall`. Other findings were fixed before `v0` was deployed. |
| 2026-11-28 | `taproom/v1` | realm, `commitreveal`, `avatar`, `sealedpoll`, settle checker | No critical, high or medium findings. 4 low and 2 info findings, listed below. |

### Findings in `taproom/v1`, fixed in `taproom/v2`

| ID | Level | Finding | Fix |
|---|---|---|---|
| L-1 | Low | A listed player whose value fell below every other row stayed on a full board, so a player who ranked higher could stay off it. Display only. | The row leaves a full board when it would land last. The free row goes to the next player whose stats change. |
| L-2 | Low | `Settle` is the one write without the direct-wallet check. | Kept on purpose: Settle reads no caller and pays the same whoever calls it, so a keeper or another realm can settle rounds. A wallet calling it must still send no coins. |
| L-3 | Low | A commit in uppercase hex was accepted but could never be revealed, so the player lost 1 GNOT. Only a custom client could send one. | `Join` rejects a commit that is not lowercase. |
| L-4 | Low | Anyone could fill the home page's recent results with empty, cancelled rounds. | Recent results list completed rounds only. |
| I-1 | Info | Coins sent with any call other than `Join` stayed in the realm with no owner. | Every write except `Join` rejects attached coins. |
| I-2 | Info | `sealedpoll` has no cap on votes per poll, so a very large number of funded addresses could make one poll's page too large to render. It holds no coins. | Not fixed; listed under known limits. |

## Accepted by design

- **Two-player tables.** With two revealed picks the lower one always wins. The web app warns before you seal at a table with two or fewer seats.
- **Last revealer's option.** A late revealer can see earlier reveals and choose not to reveal, forfeiting their 1 GNOT.
- **Several wallets.** One person with several wallets pays for each seat. Points farmed this way only buy cosmetics and never affect payouts.
- **Fixed fee recipient.** Fees go to the deploying address and only `WithdrawFees` moves them.
- **Settler pays the storage deposit** for writing every seat's credit (about 1.4 GNOT at 10 seats on a local chain). Winners and refunded players have a reason to settle.

## Checking a round yourself

`tools/verify/verify-round.mjs` re-checks any settled round from the chain with no shared code: each reveal against its commit, the pot, the winners, the fee and the split. See [Check any round yourself](README.md#check-any-round-yourself).
