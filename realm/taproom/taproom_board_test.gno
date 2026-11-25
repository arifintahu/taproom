package taproom

import (
	"strings"
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

// playRound runs a full 3-player round: picks 10, 50 and 20 with salts "s0".."s2", and reveals
// only the players in reveal. Returns the round ID.
func playRound(cur realm, t *testing.T, start int64, who [3]address, reveal [3]bool) int {
	nowOverride = start
	id := NewRound(cross(cur), 100, 100, 0)
	picks := [3]int64{10, 50, 20}
	salts := [3]string{"s0", "s1", "s2"}
	for i, a := range who {
		testing.SetRealm(testing.NewUserRealm(a))
		fund()
		Join(cross(cur), id, CommitHash(id, a, picks[i], salts[i]))
	}
	nowOverride = start + 150
	for i, a := range who {
		if reveal[i] {
			testing.SetRealm(testing.NewUserRealm(a))
			Reveal(cross(cur), id, picks[i], salts[i])
		}
	}
	nowOverride = start + 250
	Settle(cross(cur), id)
	return id
}

// Board stats move at Settle: net coins, wins, scored rounds and distance to the target.
func TestBoardStats(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("board-a")
	b := testutils.TestAddress("board-b")
	c := testutils.TestAddress("board-c")
	monday := int64(1795392000)
	// picks 10, 50, 20: sum 80, n 3, target 17.78. c (20) wins; distances 7.78, 32.22, 2.22
	playRound(cur, t, monday, [3]address{a, b, c}, [3]bool{true, true, true})

	pc := getPlayer(c)
	uassert.Equal(t, int64(2985000-1000000), pc.Net)
	uassert.Equal(t, int64(1), pc.Wins)
	uassert.Equal(t, int64(1), pc.Scored)
	uassert.Equal(t, int64(222), pc.DistSum100) // 2.22 in hundredths
	uassert.Equal(t, int64(-1000000), getPlayer(a).Net)
	uassert.Equal(t, int64(778), getPlayer(a).DistSum100) // 7.78, rounded
	uassert.Equal(t, int64(1), pc.BestStreak)

	// A void round refunds everyone: net coins do not move, and nothing is scored.
	playRound(cur, t, monday+1000, [3]address{a, b, c}, [3]bool{true, false, false})
	uassert.Equal(t, int64(-1000000), getPlayer(a).Net)
	uassert.Equal(t, int64(1), getPlayer(a).Scored)

	// A forfeit loses the entry and scores nothing.
	playRound(cur, t, monday+2000, [3]address{a, b, c}, [3]bool{true, false, true})
	uassert.Equal(t, int64(-2000000), getPlayer(b).Net)
	uassert.Equal(t, int64(1), getPlayer(b).Scored)
}

func TestLeaderboardJSON(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("lb-a")
	b := testutils.TestAddress("lb-b")
	c := testutils.TestAddress("lb-c")
	playRound(cur, t, 1795392000, [3]address{a, b, c}, [3]bool{true, true, true})
	getPlayer(a).Equipped = [4]int{104, 0, 0, 0} // a legendary hat: style 10

	net := LeaderboardJSON("net", 10)
	uassert.True(t, strings.HasPrefix(net, `[{"rank":1,"addr":"`+c.String()+`","points":`))
	sharp := LeaderboardJSON("sharp", 10)
	uassert.True(t, strings.Index(sharp, c.String()) < strings.Index(sharp, a.String())) // 2.22 before 7.78
	uassert.True(t, strings.Contains(sharp, `"sharp100":222`))
	style := LeaderboardJSON("style", 1)
	uassert.True(t, strings.Contains(style, a.String()) && strings.Contains(style, `"style":10`))
	uassert.Equal(t, 1, strings.Count(style, `"rank"`))
	uassert.True(t, strings.HasPrefix(LeaderboardJSON("points", 10), `[{"rank":1,"addr":"`+c.String()))
	uassert.PanicsContains(t, cur, "unknown board", func() { LeaderboardJSON("wealth", 10) })
}

func TestRenderPages(cur realm, t *testing.T) {
	reset()
	a := testutils.TestAddress("page-a")
	b := testutils.TestAddress("page-b")
	c := testutils.TestAddress("page-c")
	playRound(cur, t, 1795392000, [3]address{a, b, c}, [3]bool{true, true, true})
	nowOverride = 1795392300
	testing.SetRealm(testing.NewUserRealm(a))
	NewRound(cross(cur), 120, 120, 0) // an open table

	home := Render("")
	uassert.True(t, strings.Contains(home, "# Taproom"))
	uassert.True(t, strings.Contains(home, "## Open tables"))
	uassert.True(t, strings.Contains(home, "Round 1"))
	uassert.True(t, strings.Contains(home, "## Recent results"))
	uassert.True(t, strings.Contains(home, "![gnome](data:image/svg+xml;base64,"))
	uassert.True(t, strings.Contains(home, ":board/net"))

	board := Render("board/sharp")
	uassert.True(t, strings.Contains(board, "Sharpest guesses"))
	uassert.True(t, strings.Contains(board, "2.2")) // c's average distance

	player := Render("player/" + c.String())
	uassert.True(t, strings.Contains(player, "![gnome](data:image/svg+xml;base64,"))
	uassert.True(t, strings.Contains(player, "Wins: 1"))

	round := Render("round/0")
	uassert.True(t, strings.Contains(round, "Target: 17.78"))
	uassert.True(t, strings.Contains(round, "winner"))

	uassert.True(t, strings.Contains(Render("round/99"), "Not found"))
	uassert.True(t, strings.Contains(Render("nowhere"), "Not found"))
}
