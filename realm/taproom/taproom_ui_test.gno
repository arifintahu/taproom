package taproom

import (
	"strconv"
	"strings"
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

// Windows of 1 minute to 24 hours; at most 3 open rounds per address.
func TestNewRoundBoundsCreatorAndOpenCap(cur realm, t *testing.T) {
	reset()
	nowOverride = 9000
	u := testutils.TestAddress("opener")
	testing.SetRealm(testing.NewUserRealm(u))

	uassert.AbortsContains(t, cur, "1 minute to 24 hours", func() { NewRound(cross(cur), 59, 120, 0) })
	uassert.AbortsContains(t, cur, "1 minute to 24 hours", func() { NewRound(cross(cur), 120, 86401, 0) })

	a := NewRound(cross(cur), 60, 86400, 0)
	uassert.Equal(t, int64(9000), rounds[a].Start)
	uassert.Equal(t, u, rounds[a].Creator)
	NewRound(cross(cur), 120, 120, 0)
	NewRound(cross(cur), 120, 120, 0)
	uassert.AbortsContains(t, cur, "3 open rounds", func() { NewRound(cross(cur), 120, 120, 0) })

	// a settled round frees a slot
	nowOverride = 9000 + 60 + 86400
	Settle(cross(cur), a)
	NewRound(cross(cur), 120, 120, 0)
}

// At most 10 players per round.
func TestJoinPlayerCap(cur realm, t *testing.T) {
	reset()
	nowOverride = 10000
	id := NewRound(cross(cur), 100, 100, 0)
	for i := 0; i < maxPlayers; i++ {
		testing.SetRealm(testing.NewUserRealm(testutils.TestAddress("cap" + strconv.Itoa(i))))
		fund()
		Join(cross(cur), id, CommitHash(int64(i), "s"))
	}
	testing.SetRealm(testing.NewUserRealm(testutils.TestAddress("cap-late")))
	fund()
	uassert.AbortsContains(t, cur, "round is full", func() { Join(cross(cur), id, CommitHash(1, "s")) })
	uassert.Equal(t, int64(maxPlayers)*entryFee, rounds[id].Pot)
}

// Item IDs: itemID = slotBase + n (hat 100, outfit 200, held 300, companion 400), n = 1..12,
// prices by rarity 40 / 150 / 400 / 1000; Equip(slot, 0) unequips.
func TestBuyItemAndEquip(cur realm, t *testing.T) {
	reset()
	u := testutils.TestAddress("dresser")
	testing.SetRealm(testing.NewUserRealm(u))

	uassert.Equal(t, int64(40), itemPrice(101))
	uassert.Equal(t, int64(150), itemPrice(107))
	uassert.Equal(t, int64(400), itemPrice(210))
	uassert.Equal(t, int64(1000), itemPrice(412))
	uassert.AbortsContains(t, cur, "unknown item", func() { BuyItem(cross(cur), 113) })
	uassert.AbortsContains(t, cur, "unknown item", func() { BuyItem(cross(cur), 500) })
	uassert.AbortsContains(t, cur, "unknown item", func() { BuyItem(cross(cur), 100) })
	uassert.AbortsContains(t, cur, "not enough points", func() { BuyItem(cross(cur), 101) })

	getPlayer(u).Lifetime = 200
	BuyItem(cross(cur), 101) // Feather band, common
	BuyItem(cross(cur), 107) // Pirate tricorn, rare
	_, spendable, _, _ := PlayerStats(u)
	uassert.Equal(t, int64(10), spendable)
	uassert.AbortsContains(t, cur, "already owned", func() { BuyItem(cross(cur), 101) })

	uassert.AbortsContains(t, cur, "not owned", func() { Equip(cross(cur), 1, 201) })
	uassert.AbortsContains(t, cur, "does not fit", func() { Equip(cross(cur), 1, 101) })
	uassert.AbortsContains(t, cur, "unknown slot", func() { Equip(cross(cur), 4, 101) })
	Equip(cross(cur), 0, 107)
	uassert.Equal(t, 107, getPlayer(u).Equipped[0])
	Equip(cross(cur), 0, 0)
	uassert.Equal(t, 0, getPlayer(u).Equipped[0])
	// points never decrease Lifetime; Spent stays within Lifetime
	uassert.Equal(t, int64(200), getPlayer(u).Lifetime)
	uassert.True(t, getPlayer(u).Spent <= getPlayer(u).Lifetime)
}

// A freeze bought now cannot cover weeks already missed, and a stale count cannot block the purchase:
// BuyFreeze first applies the missed weeks, exactly as the next Reveal would.
func TestBuyFreezeAppliesMissedWeeks(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("jar-buyer")
	monday := int64(1795392000)
	week := int64(604800)
	play(a, monday+10)
	play(a, monday+week+10)
	play(a, monday+2*week+10) // streak 3, week 2
	getPlayer(a).Lifetime += 200
	nowOverride = monday + 2*week + 20
	testing.SetRealm(testing.NewUserRealm(a))
	BuyFreeze(cross(cur))
	BuyFreeze(cross(cur))

	// weeks 3 and 4 missed; in week 5 both freezes are spent, so a third purchase works
	nowOverride = monday + 5*week + 10
	BuyFreeze(cross(cur))
	p := getPlayer(a)
	uassert.Equal(t, 1, p.Freezes)
	uassert.Equal(t, int64(3), p.Streak)
	// the next play continues the streak: 4 weeks
	play(a, nowOverride+5)
	uassert.Equal(t, int64(4), p.Streak)

	// three more weeks missed with one freeze: the streak shows 0 and the freeze is used up
	nowOverride = monday + 9*week + 10
	uassert.True(t, strings.Contains(PlayerJSON(a), `"streak":0,`))
	uassert.True(t, strings.Contains(PlayerJSON(a), `"freezes":0,`))
	// the view does not change state
	uassert.Equal(t, 1, p.Freezes)
	play(a, nowOverride+5)
	uassert.Equal(t, int64(1), p.Streak)
	uassert.Equal(t, 0, p.Freezes)
}

func TestViewsJSON(cur realm, t *testing.T) {
	reset()
	nowOverride = 20000
	u := testutils.TestAddress("viewer")
	testing.SetRealm(testing.NewUserRealm(u))
	id := NewRound(cross(cur), 100, 100, 0)
	fund()
	Join(cross(cur), id, CommitHash(22, "salt"))

	uassert.Equal(t, 1, RoundCount())
	js := RoundsJSON(0, 10)
	uassert.True(t, strings.HasPrefix(js, `[{"id":0,"creator":"`+u.String()+`","skin":0,"start":20000,"commitEnd":20100,"revealEnd":20200,"num":2,"den":3,"settled":false,"pot":1000000,"fee":0,"winners":[],"entries":[{"addr":"`+u.String()+`","revealed":false,"pick":null,"bonus":0}]}]`))
	uassert.Equal(t, "[]", RoundsJSON(5, 10))
	uassert.Equal(t, RoundJSON(id), js[1:len(js)-1])

	nowOverride = 20150
	Reveal(cross(cur), id, 22, "salt")
	uassert.True(t, strings.Contains(RoundJSON(id), `"revealed":true,"pick":22,"bonus":4`))

	pj := PlayerJSON(u)
	uassert.True(t, strings.HasPrefix(pj, `{"addr":"`+u.String()+`","lifetime":0,"spent":0,"streak":1,"lastWeek":`))
	uassert.True(t, strings.HasSuffix(pj, `"freezes":0,"owned":[],"equipped":[0,0,0,0],"skins":[0],"claimable":0}`))
	uassert.Equal(t, feeRecipient, FeeRecipient())
	uassert.Equal(t, int64(0), FeesAccrued())
	// an unknown player reads as empty
	uassert.True(t, strings.Contains(PlayerJSON(testutils.TestAddress("nobody")), `"lastWeek":null`))
}
