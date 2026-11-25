package taproom

import (
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

// D15: the round creator must own the board skin; Oak (0) is free for everyone.
func TestBoardSkinOwnership(cur realm, t *testing.T) {
	reset()
	nowOverride = 7000
	u := testutils.TestAddress("skin-owner")
	v := testutils.TestAddress("skin-other")

	testing.SetRealm(testing.NewUserRealm(u))
	// Oak works for a new player with no points.
	oak := NewRound(cross(cur), 100, 100, 0)
	uassert.Equal(t, 0, rounds[oak].BoardSkin)
	// A skin the player does not own is refused, as is an unknown skin ID.
	uassert.AbortsContains(t, cur, "does not own", func() { NewRound(cross(cur), 100, 100, 1) })
	uassert.AbortsContains(t, cur, "unknown board skin", func() { NewRound(cross(cur), 100, 100, 3) })
	uassert.AbortsContains(t, cur, "unknown board skin", func() { NewRound(cross(cur), 100, 100, -1) })

	// Buying needs points, and Oak is not for sale.
	uassert.AbortsContains(t, cur, "not enough points", func() { BuySkin(cross(cur), 1) })
	uassert.AbortsContains(t, cur, "unknown or free", func() { BuySkin(cross(cur), 0) })
	getPlayer(u).Lifetime = 500 // simulate earned points

	BuySkin(cross(cur), 1) // Moonlit, 150
	lifetime, spendable, _, _ := PlayerStats(u)
	uassert.Equal(t, int64(500), lifetime)
	uassert.Equal(t, int64(350), spendable)
	uassert.True(t, OwnsSkin(u, 1))
	uassert.False(t, OwnsSkin(u, 2))
	uassert.AbortsContains(t, cur, "already owned", func() { BuySkin(cross(cur), 1) })
	// Gold-trim costs 400 and only 350 points are left.
	uassert.AbortsContains(t, cur, "not enough points", func() { BuySkin(cross(cur), 2) })

	moon := NewRound(cross(cur), 100, 100, 1)
	uassert.Equal(t, 1, rounds[moon].BoardSkin)

	// Another player does not get the skin from the owner's purchase.
	testing.SetRealm(testing.NewUserRealm(v))
	uassert.False(t, OwnsSkin(v, 1))
	uassert.AbortsContains(t, cur, "does not own", func() { NewRound(cross(cur), 100, 100, 1) })
	other := NewRound(cross(cur), 100, 100, 0)
	uassert.Equal(t, 0, rounds[other].BoardSkin)
}

// D14: the round stores the target fraction (2/3 in the MVP) and Settle uses the stored values.
func TestTargetFractionIsStoredAndUsed(cur realm, t *testing.T) {
	reset()
	nowOverride = 8000
	alice := testutils.TestAddress("frac-a")
	bob := testutils.TestAddress("frac-b")
	carol := testutils.TestAddress("frac-c")

	testing.SetRealm(testing.NewUserRealm(alice))
	id := NewRound(cross(cur), 100, 100, 0)
	uassert.Equal(t, int64(2), rounds[id].Num)
	uassert.Equal(t, int64(3), rounds[id].Den)

	// Picks 10, 50, 90: with 2/3 the winner would be 50 (target 33.3). Switch the stored
	// fraction to 1/2 (target 25) before settling: 10 is then the closest pick.
	rounds[id].Num, rounds[id].Den = 1, 2

	fund()
	Join(cross(cur), id, CommitHash(10, "sa"))
	testing.SetRealm(testing.NewUserRealm(bob))
	fund()
	Join(cross(cur), id, CommitHash(50, "sb"))
	testing.SetRealm(testing.NewUserRealm(carol))
	fund()
	Join(cross(cur), id, CommitHash(90, "sc"))

	nowOverride = 8150
	testing.SetRealm(testing.NewUserRealm(alice))
	Reveal(cross(cur), id, 10, "sa")
	testing.SetRealm(testing.NewUserRealm(bob))
	Reveal(cross(cur), id, 50, "sb")
	testing.SetRealm(testing.NewUserRealm(carol))
	Reveal(cross(cur), id, 90, "sc")

	nowOverride = 8250
	Settle(cross(cur), id)
	uassert.Equal(t, netPrize(3*entryFee), Claimable(alice))
	uassert.Equal(t, int64(0), Claimable(bob))
	assertSolvent(t)
}
