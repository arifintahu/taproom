package taproom

import (
	"strconv"
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
	uassert.Equal(t, 3, len(boardTop[4]))

	// b buys and wears a legendary hat: first on the style board, still one row each
	getPlayer(b).Lifetime += 1000
	testing.SetRealm(testing.NewUserRealm(b))
	BuyItem(cross(cur), 104)
	Equip(cross(cur), 0, 104)
	rows := board("style", 0)
	uassert.Equal(t, b, rows[0].addr)
	uassert.Equal(t, 3, len(rows))
	Equip(cross(cur), 0, 0)
	uassert.Equal(t, 3, len(boardTop[4]))

	// a stranger who never joined is not listed, even after a write
	s := testutils.TestAddress("idx-stranger")
	testing.SetRealm(testing.NewUserRealm(s))
	Equip(cross(cur), 0, 0)
	uassert.False(t, strings.Contains(LeaderboardJSON("style", 50), s.String()))
	uassert.Equal(t, 3, len(boardTop[4]))
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
	uassert.AbortsContains(t, cur, "16 to 128 visible ASCII", func() { Reveal(cross(cur), id, 33, "short") })
	uassert.AbortsContains(t, cur, "16 to 128 visible ASCII", func() { Reveal(cross(cur), id, 33, "has a space in it ok") })

	testing.SetRealm(testing.NewCodeRealm("gno.land/r/demo/other"))
	uassert.AbortsContains(t, cur, "direct user call", func() { NewRound(cross(cur), 100, 100, 0) })
}

// Each board keeps only its top 50 rows, best first, so updating a board writes one short list
// however many players there are. A player who climbs back is reinserted at their new place.
func TestBoardKeepsTop50(cur realm, t *testing.T) {
	reset()
	var who []address
	for i := 0; i < 55; i++ {
		a := testutils.TestAddress("top-" + strconv.Itoa(i))
		who = append(who, a)
		p := getPlayer(a)
		p.Joined = true
		p.Lifetime = int64(10 * (i + 1))
		reindex(a)
	}
	rows := board("points", 0)
	uassert.Equal(t, maxBoardRows, len(rows))
	uassert.Equal(t, who[54], rows[0].addr) // 550 points
	uassert.Equal(t, who[5], rows[49].addr) // 60 points; the five lowest are not listed
	for i := 1; i < len(rows); i++ {
		uassert.True(t, rows[i-1].p.Lifetime >= rows[i].p.Lifetime)
	}

	// the lowest player overtakes everyone: listed first, the list stays at 50
	getPlayer(who[0]).Lifetime = 1000
	reindex(who[0])
	rows = board("points", 0)
	uassert.Equal(t, maxBoardRows, len(rows))
	uassert.Equal(t, who[0], rows[0].addr)
	uassert.Equal(t, who[6], rows[49].addr)

	// one row per player: an unchanged reindex leaves the board as it is
	reindex(who[0])
	uassert.Equal(t, maxBoardRows, len(board("points", 0)))
	uassert.Equal(t, who[0], board("points", 1)[0].addr)
}

// Commits and revealed picks live on the round's seats, in join order.
func TestSeatsKeepCommitAndPick(cur realm, t *testing.T) {
	reset()
	nowOverride = 7000
	testing.SetRealm(testing.NewUserRealm(testutils.TestAddress("host")))
	id := NewRound(cross(cur), 100, 100, 0)
	a := testutils.TestAddress("seat-a")
	b := testutils.TestAddress("seat-b")
	ha := CommitHash(id, a, 12, "a"+pad)
	hb := CommitHash(id, b, 34, "b"+pad)
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), id, ha)
	testing.SetRealm(testing.NewUserRealm(b))
	fund()
	Join(cross(cur), id, hb)
	r := getRound(id)
	uassert.Equal(t, 2, len(r.Seats))
	uassert.Equal(t, ha, r.Seats[0].Commit)
	uassert.Equal(t, hb, r.Seats[1].Commit)

	nowOverride = 7150
	Reveal(cross(cur), id, 34, "b"+pad)
	uassert.Equal(t, int64(34), r.Seats[1].Pick)
	uassert.Equal(t, "b"+pad, r.Seats[1].Salt)
	uassert.Equal(t, "", r.Seats[0].Salt) // a has not revealed
	js := RoundJSON(id)
	uassert.True(t, strings.Contains(js, `"commit":"`+ha+`","revealed":false,"pick":null,"salt":null`))
	uassert.True(t, strings.Contains(js, `"commit":"`+hb+`","revealed":true,"pick":34,"salt":"b`+pad+`"`))
}
