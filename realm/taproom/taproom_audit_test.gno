package taproom

import (
	"strings"
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

// After a reset for missed weeks (streak 0), freezes bought later are kept for future weeks:
// the next play starts a new streak without spending them on weeks before the purchase.
func TestFreezesBoughtAfterResetAreKept(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("restarter")
	monday := int64(1795392000)
	week := int64(604800)
	play(a, monday+10) // week 0, streak 1
	getPlayer(a).Lifetime += 200

	// week 5: four weeks missed with no freeze, so the streak resets to 0; then buy two freezes
	nowOverride = monday + 5*week + 10
	testing.SetRealm(testing.NewUserRealm(a))
	BuyFreeze(cross(cur))
	BuyFreeze(cross(cur))
	p := getPlayer(a)
	uassert.Equal(t, int64(0), p.Streak)
	uassert.Equal(t, 2, p.Freezes)

	// week 7: a new streak starts and both freezes are still held
	play(a, monday+7*week+10)
	uassert.Equal(t, int64(1), p.Streak)
	uassert.Equal(t, 2, p.Freezes)
}

// The open-round cap is a counter per creator: settling frees a slot, other creators are not counted.
func TestOpenRoundCounter(cur realm, t *testing.T) {
	reset()
	nowOverride = 9000
	a := testutils.TestAddress("counter-a")
	b := testutils.TestAddress("counter-b")
	testing.SetRealm(testing.NewUserRealm(a))
	r0 := NewRound(cross(cur), 60, 60, 0)
	NewRound(cross(cur), 60, 60, 0)
	NewRound(cross(cur), 60, 60, 0)
	testing.SetRealm(testing.NewUserRealm(b))
	NewRound(cross(cur), 60, 60, 0) // b has its own 3
	uassert.Equal(t, 3, openCount(a))
	uassert.Equal(t, 1, openCount(b))
	uassert.Equal(t, 4, openRounds.Size())

	nowOverride = 9200
	Settle(cross(cur), r0) // anyone can settle; the slot goes back to the creator
	uassert.Equal(t, 2, openCount(a))
	uassert.Equal(t, 3, openRounds.Size())
	uassert.Equal(t, 1, len(recentSettled))
	testing.SetRealm(testing.NewUserRealm(a))
	NewRound(cross(cur), 60, 60, 0)
	uassert.Equal(t, 5, RoundCount())
}

// Board indexes follow stat changes: one row per player, re-sorted on Equip, and only players
// who have joined a round are listed.
func TestBoardIndexFollowsStats(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("idx-a")
	b := testutils.TestAddress("idx-b")
	c := testutils.TestAddress("idx-c")
	playRound(cur, t, 1795392000, [3]address{a, b, c}, [3]bool{true, true, true})
	uassert.Equal(t, 3, len(board("style", 0)))
	uassert.Equal(t, 3, boardIdx[4].Size())

	// b buys and wears a legendary hat: first on the style board, still one row each
	getPlayer(b).Lifetime += 1000
	testing.SetRealm(testing.NewUserRealm(b))
	BuyItem(cross(cur), 104)
	Equip(cross(cur), 0, 104)
	rows := board("style", 0)
	uassert.Equal(t, b, rows[0].addr)
	uassert.Equal(t, 3, len(rows))
	Equip(cross(cur), 0, 0)
	uassert.Equal(t, 3, boardIdx[4].Size())

	// a stranger who never joined is not listed, even after a write
	s := testutils.TestAddress("idx-stranger")
	testing.SetRealm(testing.NewUserRealm(s))
	Equip(cross(cur), 0, 0)
	uassert.False(t, strings.Contains(LeaderboardJSON("style", 50), s.String()))
	uassert.Equal(t, 3, boardIdx[4].Size())
}

// Reveal needs a salt of 16+ characters (a short one lets anyone guess the pick from the hash), and
// NewRound, like every other write, takes direct wallet calls only.
func TestShortSaltAndCodeCallsRejected(cur realm, t *testing.T) {
	reset()
	nowOverride = 6000
	testing.SetRealm(testing.NewUserRealm(testutils.TestAddress("host")))
	id := NewRound(cross(cur), 100, 100, 0)
	a := testutils.TestAddress("short-salt")
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), id, CommitHash(id, a, 33, "short"))
	nowOverride = 6150
	uassert.AbortsContains(t, cur, "at least 16", func() { Reveal(cross(cur), id, 33, "short") })

	testing.SetRealm(testing.NewCodeRealm("gno.land/r/demo/other"))
	uassert.AbortsContains(t, cur, "direct user call", func() { NewRound(cross(cur), 100, 100, 0) })
}
