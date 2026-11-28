package taproom

import (
	"chain"
	"strconv"
	"strings"
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

func listed(i int, a address) bool {
	for _, r := range boardTop[i] {
		if r.Addr == a {
			return true
		}
	}
	return false
}

// A listed player whose value falls below every other row leaves a full board, instead of
// holding the last row while better players stay off the list.
func TestBoardDropsFallenRow(cur realm, t *testing.T) {
	reset()
	const net = 1 // boards[1] is "net"
	var who []address
	for k := 0; k <= maxBoardRows; k++ { // 51 players, Net 100..150
		a := testutils.TestAddress("evict" + strconv.Itoa(k))
		p := getPlayer(a)
		p.Joined = true
		p.Net = int64(100 + k)
		reindex(a)
		who = append(who, a)
	}
	uassert.Equal(t, maxBoardRows, len(boardTop[net]))
	uassert.False(t, listed(net, who[0])) // 100 is 51st

	// a drop that still ranks above the last row keeps the player listed, in order
	getPlayer(who[40]).Net = 120
	reindex(who[40])
	uassert.Equal(t, maxBoardRows, len(boardTop[net]))
	uassert.True(t, listed(net, who[40]))
	for j := 1; j < len(boardTop[net]); j++ {
		uassert.True(t, boardTop[net][j-1].V >= boardTop[net][j].V)
	}

	// a drop below every listed row leaves the full board
	getPlayer(who[1]).Net = -5
	reindex(who[1])
	uassert.False(t, listed(net, who[1]))
	uassert.Equal(t, maxBoardRows-1, len(boardTop[net]))

	// the free row goes to the next player whose stats change
	reindex(who[0])
	uassert.True(t, listed(net, who[0]))
	uassert.Equal(t, maxBoardRows, len(boardTop[net]))
}

// Verify compares lowercase hex, so an uppercase commit could never be revealed.
func TestJoinRejectsUppercaseCommit(cur realm, t *testing.T) {
	reset()
	nowOverride = 5000
	testing.SetRealm(testing.NewUserRealm(testutils.TestAddress("host")))
	id := NewRound(cross(cur), 100, 100, 0)
	a := testutils.TestAddress("shouty")
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	up := strings.ToUpper(CommitHash(id, a, 10, "s"+pad))
	uassert.AbortsContains(t, cur, "lowercase", func() { Join(cross(cur), id, up) })
	unfund()
}

// Recent results list completed rounds only, so empty or void rounds cannot push them off.
func TestRecentResultsOnlyCompleted(cur realm, t *testing.T) {
	reset()
	nowOverride = 6000
	host := testutils.TestAddress("host")
	testing.SetRealm(testing.NewUserRealm(host))
	empty := NewRound(cross(cur), 60, 60, 0)
	lone := NewRound(cross(cur), 60, 60, 0)
	a := testutils.TestAddress("lonely")
	testing.SetRealm(testing.NewUserRealm(a))
	fund()
	Join(cross(cur), lone, CommitHash(lone, a, 10, "s"+pad))
	unfund()
	nowOverride = 6200
	Settle(cross(cur), empty)
	Settle(cross(cur), lone)
	uassert.Equal(t, 0, len(recentSettled))
	uassert.Equal(t, entryFee, sumClaimable()) // the void round still refunds

	id := playRound(cur, t, 7000, [3]address{
		testutils.TestAddress("rr-a"), testutils.TestAddress("rr-b"), testutils.TestAddress("rr-c"),
	}, [3]bool{true, true, true})
	uassert.Equal(t, 1, len(recentSettled))
	uassert.Equal(t, id, recentSettled[0])
}

// Only Join takes coins; coins sent with any other call would be stranded in the realm.
func TestWritesRejectCoins(cur realm, t *testing.T) {
	reset()
	nowOverride = 8000
	a := testutils.TestAddress("tipper")
	testing.SetRealm(testing.NewUserRealm(a))
	id := NewRound(cross(cur), 60, 60, 0)
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", 1)))
	uassert.AbortsContains(t, cur, "takes no coins", func() { NewRound(cross(cur), 60, 60, 0) })
	uassert.AbortsContains(t, cur, "takes no coins", func() { BuyFreeze(cross(cur)) })
	uassert.AbortsContains(t, cur, "takes no coins", func() { Equip(cross(cur), 1, 0) })
	nowOverride = 8200
	uassert.AbortsContains(t, cur, "takes no coins", func() { Settle(cross(cur), id) })
	unfund()
	Settle(cross(cur), id) // still open to anyone without coins
}

// Render pages carry gnoweb call links for what can be done now.
func TestRenderActionLinks(cur realm, t *testing.T) {
	reset()
	nowOverride = 9000
	a := testutils.TestAddress("linker")
	testing.SetRealm(testing.NewUserRealm(a))
	id := NewRound(cross(cur), 100, 100, 0)
	page := func() string { return Render("round/" + strconv.Itoa(id)) }

	uassert.True(t, strings.Contains(Render(""), "$help&func=NewRound&boardSkin=0&commitSecs=120&revealSecs=120"))
	uassert.True(t, strings.Contains(page(), "$help&func=Join&.send=1000000ugnot&commit=&roundID="+strconv.Itoa(id)))
	nowOverride = 9150
	uassert.True(t, strings.Contains(page(), "$help&func=Reveal&pick=&roundID="+strconv.Itoa(id)+"&salt="))
	nowOverride = 9250
	uassert.True(t, strings.Contains(page(), "$help&func=Settle&roundID="+strconv.Itoa(id)))
	Settle(cross(cur), id)
	uassert.True(t, strings.Contains(page(), "$help&func=Claim"))
}
