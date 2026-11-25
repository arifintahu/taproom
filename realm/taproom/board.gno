package taproom

// Leaderboards: net coins, sharpest guesses, longest streak, points and style. Stats are kept on
// each Player at Join and Settle, so a board is one pass over the players plus a sort.

import (
	"strconv"
	"strings"
)

const maxBoardRows = 50

// boards in display order: key, title, column heading.
var boards = [][3]string{
	{"points", "Points", "Lifetime points"},
	{"net", "Net coins", "Net GNOT"},
	{"sharp", "Sharpest guesses", "Avg distance"},
	{"streak", "Longest streak", "Weeks"},
	{"style", "Style", "Style score"},
}

type boardRow struct {
	addr address
	p    *Player
}

// styleOf sums rarity values of equipped items: common 1, rare 3, epic 6, legendary 10.
func styleOf(equipped [4]int) int64 {
	var s int64
	for _, id := range equipped {
		switch itemPrice(id) {
		case 40:
			s += 1
		case 150:
			s += 3
		case 400:
			s += 6
		case 1000:
			s += 10
		}
	}
	return s
}

// sharp100 is the average distance to the target in hundredths; -1 before any completed round.
func sharp100(p *Player) int64 {
	if p.Scored == 0 {
		return -1
	}
	return p.DistSum100 / p.Scored
}

// better reports whether row a ranks above row b on a board.
func better(board string, a, b *Player) bool {
	switch board {
	case "points":
		return a.Lifetime > b.Lifetime
	case "net":
		return a.Net > b.Net
	case "sharp":
		return sharp100(a) < sharp100(b) // lower is sharper; players without scores are left out
	case "streak":
		return a.BestStreak > b.BestStreak
	case "style":
		return styleOf(a.Equipped) > styleOf(b.Equipped)
	}
	panic("unknown board")
}

// board returns the top rows of a board, best first (ties keep address order).
func board(name string, limit int) []boardRow {
	known := false
	for _, b := range boards {
		known = known || b[0] == name
	}
	if !known {
		panic("unknown board: use points, net, sharp, streak or style")
	}
	if limit <= 0 || limit > maxBoardRows {
		limit = maxBoardRows
	}
	var rows []boardRow
	players.Iterate("", "", func(k string, v any) bool {
		p := v.(*Player)
		if name == "sharp" && p.Scored == 0 {
			return false
		}
		r := boardRow{addr: address(k), p: p}
		// insertion sort, keeping at most limit rows
		i := len(rows)
		for i > 0 && better(name, p, rows[i-1].p) {
			i--
		}
		if i < limit {
			rows = append(rows, boardRow{})
			copy(rows[i+1:], rows[i:])
			rows[i] = r
			if len(rows) > limit {
				rows = rows[:limit]
			}
		}
		return false
	})
	return rows
}

// LeaderboardJSON returns the top rows (at most 50) of a board: points, net, sharp, streak or style.
// Each row carries every stat, so one call can fill any column.
func LeaderboardJSON(name string, limit int) string {
	var sb strings.Builder
	sb.WriteString("[")
	for i, r := range board(name, limit) {
		if i > 0 {
			sb.WriteString(",")
		}
		sharp := "null"
		if s := sharp100(r.p); s >= 0 {
			sharp = i64(s)
		}
		sb.WriteString(`{"rank":` + strconv.Itoa(i+1) + `,"addr":"` + r.addr.String() + `","points":` + i64(r.p.Lifetime))
		sb.WriteString(`,"net":` + i64(r.p.Net) + `,"wins":` + i64(r.p.Wins) + `,"sharp100":` + sharp)
		sb.WriteString(`,"bestStreak":` + i64(r.p.BestStreak) + `,"style":` + i64(styleOf(r.p.Equipped)) + `,"equipped":`)
		writeInts(&sb, r.p.Equipped[:])
		sb.WriteString("}")
	}
	sb.WriteString("]")
	return sb.String()
}
