package taproom

import (
	"chain"
	"chain/banker"
	"testing"
	"time"

	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

var realmAddr = chain.PackageAddress("gno.land/r/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/taproom")

// fund simulates the send envelope: tests do not move coins on their own.
func fund() {
	fee := chain.NewCoins(chain.NewCoin("ugnot", entryFee))
	testing.SetOriginSend(fee)
	testing.IssueCoins(realmAddr, fee)
}

func reset() {
	roundTree = avl.NewTree()
	roundCount = 0
	openRounds = avl.NewTree()
	openByCreator = avl.NewTree()
	recentSettled = nil
	boardIdx = newBoardIdx()
	players = avl.NewTree()
	claimable = avl.NewTree()
	nowOverride = 0
	feesAccrued = 0
	// coins left in the realm by earlier tests are not owed to anyone in this test
	baseBal = banker.NewReadonlyBanker().GetCoin(realmAddr, "ugnot")
}

var baseBal int64

// play records a play at ts and pays its points at once, as a reveal in a completed round would.
func play(a address, ts int64) {
	bonus := updateStreak(a, ts)
	getPlayer(a).Lifetime += pointsPlay + bonus
}

// netPrize is what winners share after the protocol fee.
func netPrize(pot int64) int64 { return pot - pot*feeBps/bpsTotal }

func sumClaimable() int64 {
	var s int64
	claimable.Iterate("", "", func(k string, v any) bool {
		s += v.(int64)
		return false
	})
	return s
}

// assertSolvent checks the core invariant: realm coins cover every unclaimed balance plus accrued fees.
func assertSolvent(t *testing.T) {
	bal := banker.NewReadonlyBanker().GetCoin(realmAddr, "ugnot") - baseBal
	owed := sumClaimable() + feesAccrued
	if bal != owed {
		t.Fatalf("insolvent or unaccounted coins: realm balance %d, owed %d", bal, owed)
	}
}

func TestRealBlockTimeIsUsed(cur realm, t *testing.T) {
	reset()
	got := time.Now().Unix()
	uassert.Equal(t, got, now())
}

func TestWeekIndexMondayBoundary(cur realm, t *testing.T) {
	monday := int64(1795392000) // 2026-11-23 00:00:00 UTC, a Monday
	uassert.Equal(t, weekIndex(monday), weekIndex(monday+604799))
	uassert.Equal(t, weekIndex(monday)-1, weekIndex(monday-1))
	uassert.Equal(t, weekIndex(monday)+1, weekIndex(monday+604800))
}

func TestFullRoundPaysClosestToTwoThirds(cur realm, t *testing.T) {
	reset()
	nowOverride = 1000
	id := NewRound(cross(cur), 100, 100, 0)
	alice := testutils.TestAddress("alice")
	bob := testutils.TestAddress("bob")
	carol := testutils.TestAddress("carol")

	testing.SetRealm(testing.NewUserRealm(alice))
	fund()
	Join(cross(cur), id, CommitHash(id, alice, 10, "sa"))
	testing.SetRealm(testing.NewUserRealm(bob))
	fund()
	Join(cross(cur), id, CommitHash(id, bob, 50, "sb"))
	testing.SetRealm(testing.NewUserRealm(carol))
	fund()
	Join(cross(cur), id, CommitHash(id, carol, 90, "sc"))

	nowOverride = 1150
	testing.SetRealm(testing.NewUserRealm(alice))
	Reveal(cross(cur), id, 10, "sa")
	testing.SetRealm(testing.NewUserRealm(bob))
	Reveal(cross(cur), id, 50, "sb")
	testing.SetRealm(testing.NewUserRealm(carol))
	Reveal(cross(cur), id, 90, "sc")

	nowOverride = 1250
	Settle(cross(cur), id) // anyone can settle (carol here)

	uassert.Equal(t, netPrize(3*entryFee), Claimable(bob))
	uassert.Equal(t, int64(0), Claimable(alice))
	uassert.Equal(t, int64(0), Claimable(carol))
	// 0.5% of a 3,000,000 pot
	uassert.Equal(t, int64(15000), feesAccrued)
	uassert.Equal(t, int64(15000), getRound(id).Fee)
	assertSolvent(t)

	testing.SetRealm(testing.NewUserRealm(bob))
	Claim(cross(cur))
	bk := banker.NewReadonlyBanker()
	uassert.Equal(t, netPrize(3*entryFee), bk.GetCoin(bob, "ugnot"))
	// only the fee stays in the realm
	uassert.Equal(t, int64(15000), bk.GetCoin(realmAddr, "ugnot")-baseBal)
	uassert.Equal(t, int64(0), Claimable(bob))
	assertSolvent(t)

	// double claim is rejected
	uassert.AbortsContains(t, cur, "nothing to claim", func() { Claim(cross(cur)) })

	// points: bob won (30) + streak 1 bonus (4); alice only played (10 + 4)
	life, spend, streak, _ := PlayerStats(bob)
	uassert.Equal(t, int64(34), life)
	uassert.Equal(t, int64(34), spend)
	uassert.Equal(t, int64(1), streak)
	life, _, _, _ = PlayerStats(alice)
	uassert.Equal(t, int64(14), life)
}

func TestNonRevealerForfeitsToWinner(cur realm, t *testing.T) {
	reset()
	nowOverride = 2000
	id := NewRound(cross(cur), 100, 100, 0)
	alice := testutils.TestAddress("alice2")
	bob := testutils.TestAddress("bob2")
	carol := testutils.TestAddress("carol2")

	testing.SetRealm(testing.NewUserRealm(alice))
	fund()
	Join(cross(cur), id, CommitHash(id, alice, 10, "sa"))
	testing.SetRealm(testing.NewUserRealm(bob))
	fund()
	Join(cross(cur), id, CommitHash(id, bob, 50, "sb"))
	testing.SetRealm(testing.NewUserRealm(carol))
	fund()
	Join(cross(cur), id, CommitHash(id, carol, 20, "sc"))

	nowOverride = 2150
	testing.SetRealm(testing.NewUserRealm(alice))
	Reveal(cross(cur), id, 10, "sa")
	testing.SetRealm(testing.NewUserRealm(bob))
	Reveal(cross(cur), id, 50, "sb")
	// carol never reveals

	nowOverride = 2250
	Settle(cross(cur), id)
	// 2/3 of avg(10,50)=20 -> alice (10) is closer than bob (50) and takes the whole pot, incl. carol's forfeit
	// the forfeit stays in the pot, so the fee applies to the full 3-player pot
	uassert.Equal(t, netPrize(3*entryFee), Claimable(alice))
	uassert.Equal(t, int64(0), Claimable(carol))
	assertSolvent(t)
}

func TestVoidRoundRefundsEveryone(cur realm, t *testing.T) {
	reset()
	nowOverride = 3000
	id := NewRound(cross(cur), 100, 100, 0)
	alice := testutils.TestAddress("alice3")
	bob := testutils.TestAddress("bob3")

	testing.SetRealm(testing.NewUserRealm(alice))
	fund()
	Join(cross(cur), id, CommitHash(id, alice, 10, "sa"))
	testing.SetRealm(testing.NewUserRealm(bob))
	fund()
	Join(cross(cur), id, CommitHash(id, bob, 50, "sb"))

	nowOverride = 3150
	testing.SetRealm(testing.NewUserRealm(alice))
	Reveal(cross(cur), id, 10, "sa")
	nowOverride = 3250
	Settle(cross(cur), id)
	uassert.Equal(t, entryFee, Claimable(alice))
	uassert.Equal(t, entryFee, Claimable(bob))
	// a void (cancelled) round pays no fee
	uassert.Equal(t, int64(0), feesAccrued)
	uassert.Equal(t, int64(0), getRound(id).Fee)
	assertSolvent(t)
}

// A lone player who joins, reveals, and lets the round void gets a refund and no points.
// The reveal still counts for the streak (an accepted trade-off).
func TestVoidRoundGivesNoPoints(cur realm, t *testing.T) {
	reset()
	nowOverride = 7000
	id := NewRound(cross(cur), 100, 100, 0)
	solo := testutils.TestAddress("solo")

	testing.SetRealm(testing.NewUserRealm(solo))
	fund()
	Join(cross(cur), id, CommitHash(id, solo, 10, "s"))
	nowOverride = 7150
	Reveal(cross(cur), id, 10, "s")
	nowOverride = 7250
	Settle(cross(cur), id)

	uassert.Equal(t, entryFee, Claimable(solo))
	life, _, streak, _ := PlayerStats(solo)
	uassert.Equal(t, int64(0), life)
	uassert.Equal(t, int64(1), streak)
	assertSolvent(t)
}

// Points are paid at Settle, but the streak week is the week of the reveal.
func TestPointsAtSettleUseRevealWeek(cur realm, t *testing.T) {
	reset()
	monday := int64(1795392000)
	week := int64(604800)
	nowOverride = monday + week - 300 // Sunday, last minutes of the week
	id := NewRound(cross(cur), 100, 100, 0)
	a := testutils.TestAddress("rw-a")
	b := testutils.TestAddress("rw-b")

	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), id, CommitHash(id, a, 10, "sa"))
	testing.SetRealm(testing.NewUserRealm(b))
	fund()
	Join(cross(cur), id, CommitHash(id, b, 50, "sb"))

	nowOverride = monday + week - 150 // still Sunday
	testing.SetRealm(testing.NewUserRealm(a))
	Reveal(cross(cur), id, 10, "sa")
	testing.SetRealm(testing.NewUserRealm(b))
	Reveal(cross(cur), id, 50, "sb")

	// no points before the round completes
	life, _, _, _ := PlayerStats(a)
	uassert.Equal(t, int64(0), life)

	nowOverride = monday + week + 3600 // settled on Monday of the next week
	Settle(cross(cur), id)

	life, _, _, _ = PlayerStats(a)
	uassert.Equal(t, int64(34), life) // win 30 + streak bonus 4
	life, _, _, _ = PlayerStats(b)
	uassert.Equal(t, int64(14), life)
	uassert.Equal(t, weekIndex(monday), getPlayer(a).LastWeek)
}

// Round A is revealed on Sunday of week W with a long window; round B is played on Monday of
// week W+1 and settles first. The streak must still count W, and no freeze may be used.
func TestOutOfOrderSettleKeepsStreak(cur realm, t *testing.T) {
	reset()
	monday := int64(1795392000) // Monday of week W
	week := int64(604800)
	a := testutils.TestAddress("ooo-a")
	b := testutils.TestAddress("ooo-b")

	// a played in week W-1 and holds one freeze
	pa := getPlayer(a)
	pa.HasPlayed = true
	pa.LastWeek = weekIndex(monday - week)
	pa.Streak = 1
	pa.Freezes = 1

	// round A: Sunday of week W, long reveal window
	nowOverride = monday + week - 1000
	ra := NewRound(cross(cur), 500, 50000, 0)
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), ra, CommitHash(ra, a, 10, "a1"))
	testing.SetRealm(testing.NewUserRealm(b))
	fund()
	Join(cross(cur), ra, CommitHash(ra, b, 50, "b1"))
	nowOverride = monday + week - 400 // still Sunday
	testing.SetRealm(testing.NewUserRealm(a))
	Reveal(cross(cur), ra, 10, "a1")
	testing.SetRealm(testing.NewUserRealm(b))
	Reveal(cross(cur), ra, 50, "b1")

	// round B: Monday of week W+1, short windows, settled before round A
	nowOverride = monday + week + 100
	rb := NewRound(cross(cur), 100, 100, 0)
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), rb, CommitHash(rb, a, 10, "a2"))
	testing.SetRealm(testing.NewUserRealm(b))
	fund()
	Join(cross(cur), rb, CommitHash(rb, b, 50, "b2"))
	nowOverride = monday + week + 250
	testing.SetRealm(testing.NewUserRealm(a))
	Reveal(cross(cur), rb, 10, "a2")
	testing.SetRealm(testing.NewUserRealm(b))
	Reveal(cross(cur), rb, 50, "b2")
	nowOverride = monday + week + 400
	Settle(cross(cur), rb)

	nowOverride = monday + week + 49600 // round A's reveal window has closed
	Settle(cross(cur), ra)

	life, _, streak, freezes := PlayerStats(a)
	uassert.Equal(t, int64(3), streak) // weeks W-1, W, W+1
	uassert.Equal(t, 1, freezes)       // no week was missed
	// a won both: (30 + bonus 8 in week W) + (30 + bonus 12 in week W+1)
	uassert.Equal(t, int64(80), life)
	// b: first play in week W (10 + 4), then week W+1 (10 + 8)
	life, _, streak, _ = PlayerStats(b)
	uassert.Equal(t, int64(32), life)
	uassert.Equal(t, int64(2), streak)
	assertSolvent(t)
}

func TestTieSplitWithRemainderAndFee(cur realm, t *testing.T) {
	reset()
	oldFee := entryFee
	entryFee = 1000001 // odd amounts force a remainder
	defer func() { entryFee = oldFee }()

	nowOverride = 5000
	id := NewRound(cross(cur), 100, 100, 0)
	a := testutils.TestAddress("tie-a")
	b := testutils.TestAddress("tie-b")
	c := testutils.TestAddress("tie-c")

	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), id, CommitHash(id, a, 10, "sa"))
	testing.SetRealm(testing.NewUserRealm(b))
	fund()
	Join(cross(cur), id, CommitHash(id, b, 10, "sb"))
	testing.SetRealm(testing.NewUserRealm(c))
	fund()
	Join(cross(cur), id, CommitHash(id, c, 90, "sc"))

	nowOverride = 5150
	testing.SetRealm(testing.NewUserRealm(a))
	Reveal(cross(cur), id, 10, "sa")
	testing.SetRealm(testing.NewUserRealm(b))
	Reveal(cross(cur), id, 10, "sb")
	testing.SetRealm(testing.NewUserRealm(c))
	Reveal(cross(cur), id, 90, "sc")

	nowOverride = 5250
	Settle(cross(cur), id)

	pot := 3 * entryFee // 3,000,003
	fee := pot * feeBps / bpsTotal
	prize := pot - fee
	// a and b tie; the remainder goes to the first winner in join order
	uassert.Equal(t, prize/2+prize%2, Claimable(a))
	uassert.Equal(t, prize/2, Claimable(b))
	uassert.Equal(t, int64(0), Claimable(c))
	uassert.Equal(t, prize, Claimable(a)+Claimable(b))
	assertSolvent(t)
}

func TestWithdrawFees(cur realm, t *testing.T) {
	reset()
	owner := testutils.TestAddress("fee-owner")
	stranger := testutils.TestAddress("fee-stranger")
	oldRecipient := feeRecipient
	feeRecipient = owner
	defer func() { feeRecipient = oldRecipient }()

	nowOverride = 6000
	id := NewRound(cross(cur), 100, 100, 0)
	a := testutils.TestAddress("wf-a")
	b := testutils.TestAddress("wf-b")
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), id, CommitHash(id, a, 10, "sa"))
	testing.SetRealm(testing.NewUserRealm(b))
	fund()
	Join(cross(cur), id, CommitHash(id, b, 50, "sb"))
	nowOverride = 6150
	testing.SetRealm(testing.NewUserRealm(a))
	Reveal(cross(cur), id, 10, "sa")
	testing.SetRealm(testing.NewUserRealm(b))
	Reveal(cross(cur), id, 50, "sb")
	nowOverride = 6250
	Settle(cross(cur), id)
	uassert.Equal(t, int64(10000), feesAccrued) // 0.5% of 2,000,000

	testing.SetRealm(testing.NewUserRealm(stranger))
	uassert.AbortsContains(t, cur, "only the fee recipient", func() { WithdrawFees(cross(cur)) })

	testing.SetRealm(testing.NewUserRealm(owner))
	WithdrawFees(cross(cur))
	uassert.Equal(t, int64(10000), banker.NewReadonlyBanker().GetCoin(owner, "ugnot"))
	uassert.Equal(t, int64(0), feesAccrued)
	assertSolvent(t)
	uassert.AbortsContains(t, cur, "no fees", func() { WithdrawFees(cross(cur)) })
}

func TestRejections(cur realm, t *testing.T) {
	reset()
	nowOverride = 4000
	id := NewRound(cross(cur), 100, 100, 0)
	alice := testutils.TestAddress("alice4")
	bob := testutils.TestAddress("bob4")

	// wrong amount
	testing.SetRealm(testing.NewUserRealm(alice))
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", entryFee-1)))
	uassert.AbortsContains(t, cur, "exact", func() { Join(cross(cur), id, CommitHash(id, alice, 1, "x")) })

	fund()
	Join(cross(cur), id, CommitHash(id, alice, 10, "sa"))
	// double join
	uassert.AbortsContains(t, cur, "already joined", func() { Join(cross(cur), id, CommitHash(id, alice, 1, "x")) })

	// reveal too early
	uassert.AbortsContains(t, cur, "not in reveal window", func() { Reveal(cross(cur), id, 10, "sa") })

	nowOverride = 4150
	// wrong salt
	uassert.AbortsContains(t, cur, "does not match", func() { Reveal(cross(cur), id, 10, "wrong") })
	// stranger cannot reveal
	testing.SetRealm(testing.NewUserRealm(bob))
	uassert.AbortsContains(t, cur, "not a player", func() { Reveal(cross(cur), id, 10, "sa") })
	// join after commit window
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", entryFee)))
	uassert.AbortsContains(t, cur, "closed", func() { Join(cross(cur), id, CommitHash(id, bob, 1, "x")) })
	// settle too early
	uassert.AbortsContains(t, cur, "still open", func() { Settle(cross(cur), id) })
}

func TestStreakBonusFreezeAndReset(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("streaker")
	monday := int64(1795392000)
	week := int64(604800)

	// week 0: first play -> streak 1, +10 +4
	play(a, monday+10)
	life, _, streak, _ := PlayerStats(a)
	uassert.Equal(t, int64(14), life)
	uassert.Equal(t, int64(1), streak)

	// same week again: bonus paid again (+10 +4)
	play(a, monday+20)
	life, _, streak, _ = PlayerStats(a)
	uassert.Equal(t, int64(28), life)
	uassert.Equal(t, int64(1), streak)

	// consecutive weeks: bonus 8, 12, 16, 20, 20
	expect := []int64{8, 12, 16, 20, 20}
	for i, b := range expect {
		before, _, _, _ := PlayerStats(a)
		play(a, monday+week*int64(i+1)+5)
		after, _, _, _ := PlayerStats(a)
		uassert.Equal(t, int64(10)+b, after-before)
	}
	_, _, streak, _ = PlayerStats(a)
	uassert.Equal(t, int64(6), streak)

	// buy two freezes (80 points); a third must fail
	testing.SetRealm(testing.NewUserRealm(a))
	BuyFreeze(cross(cur))
	BuyFreeze(cross(cur))
	uassert.AbortsContains(t, cur, "freeze limit", func() { BuyFreeze(cross(cur)) })
	_, spendable, _, freezes := PlayerStats(a)
	uassert.Equal(t, 2, freezes)
	uassert.Equal(t, int64(74), spendable) // 154 lifetime - 80 spent

	// last played week is 5; skip weeks 6 and 7, play in week 8 with two freezes
	// -> both freezes consumed, streak continues (6 -> 7)
	play(a, monday+week*8+5)
	_, _, streak, freezes = PlayerStats(a)
	uassert.Equal(t, int64(7), streak)
	uassert.Equal(t, 0, freezes)

	// buy one more freeze, then skip weeks 9, 10, 11 (three missed) and play in week 12
	// one freeze cannot cover three weeks -> streak resets to 1 and the freeze is used up
	BuyFreeze(cross(cur))
	play(a, monday+week*12+5)
	_, _, streak, freezes = PlayerStats(a)
	uassert.Equal(t, int64(1), streak)
	uassert.Equal(t, 0, freezes)
}

// A commit is bound to its round and its player: a copied hash cannot be opened by the copier,
// and a hash from one round cannot be reused in another.
func TestCopiedCommitCannotBeRevealed(cur realm, t *testing.T) {
	reset()
	nowOverride = 5000
	id := NewRound(cross(cur), 100, 100, 0)
	other := NewRound(cross(cur), 100, 100, 0)
	victim := testutils.TestAddress("victim")
	copier := testutils.TestAddress("copier")

	testing.SetRealm(testing.NewUserRealm(victim))
	fund()
	h := CommitHash(id, victim, 20, "secret")
	Join(cross(cur), id, h)

	testing.SetRealm(testing.NewUserRealm(copier))
	fund()
	Join(cross(cur), id, h) // the hash is public; joining with it is allowed
	fund()
	Join(cross(cur), other, h)

	nowOverride = 5150
	testing.SetRealm(testing.NewUserRealm(victim))
	Reveal(cross(cur), id, 20, "secret")

	testing.SetRealm(testing.NewUserRealm(copier))
	uassert.AbortsContains(t, cur, "does not match", func() { Reveal(cross(cur), id, 20, "secret") })
	uassert.AbortsContains(t, cur, "does not match", func() { Reveal(cross(cur), other, 20, "secret") })
}
