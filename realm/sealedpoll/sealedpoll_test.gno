package sealedpoll

import (
	"strings"
	"testing"

	"gno.land/p/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/commitreveal/v0"
	"gno.land/p/nt/avl/v0"
	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

var (
	alice = testutils.TestAddress("poll-alice")
	bob   = testutils.TestAddress("poll-bob")
	carol = testutils.TestAddress("poll-carol")
)

// salt is long enough for Open (at least 16 characters).
const salt = "poll-salt-0123456789"

func reset() {
	polls = avl.NewTree()
	pollCount = 0
	nowOverride = 1000
}

func TestPollLifecycle(cur realm, t *testing.T) {
	reset()
	testing.SetRealm(testing.NewUserRealm(alice))
	id := NewPoll(cross(cur), "Ale or cider?", "ale, cider", 60, 60)
	uassert.Equal(t, 0, id)
	uassert.Equal(t, 1, PollCount())

	// Voting: each voter seals a choice; only the hash goes on chain.
	Vote(cross(cur), id, commitreveal.Hash("ale", "a-salt-0123456789"))
	testing.SetRealm(testing.NewUserRealm(bob))
	Vote(cross(cur), id, commitreveal.Hash("cider", "b-salt-0123456789"))
	testing.SetRealm(testing.NewUserRealm(carol))
	Vote(cross(cur), id, commitreveal.Hash("ale", "c-salt-0123456789"))
	uassert.True(t, strings.Contains(Tally(id), `"phase":"vote","votes":3,"opened":0,`))

	// Opening: alice and bob open their votes; carol never does.
	nowOverride = 1070
	testing.SetRealm(testing.NewUserRealm(alice))
	Open(cross(cur), id, "ale", "a-salt-0123456789")
	testing.SetRealm(testing.NewUserRealm(bob))
	Open(cross(cur), id, "cider", "b-salt-0123456789")

	nowOverride = 1130
	uassert.Equal(t, `{"id":0,"question":"Ale or cider?","phase":"closed","votes":3,"opened":2,"counts":{"ale":1,"cider":1},"unopened":1}`, Tally(id))
	out := Render("")
	uassert.True(t, strings.Contains(out, "Ale or cider?"))
	uassert.True(t, strings.Contains(out, "ale: 1"))
	uassert.True(t, strings.Contains(out, "1 sealed vote never opened"))
}

func TestPollRules(cur realm, t *testing.T) {
	reset()
	testing.SetRealm(testing.NewUserRealm(alice))
	uassert.AbortsContains(t, cur, "2 to 8 options", func() { NewPoll(cross(cur), "Q?", "only", 60, 60) })
	uassert.AbortsContains(t, cur, "options must be different", func() { NewPoll(cross(cur), "Q?", "a, a", 60, 60) })
	uassert.AbortsContains(t, cur, "question", func() { NewPoll(cross(cur), "", "a, b", 60, 60) })
	uassert.AbortsContains(t, cur, "1 minute to 7 days", func() { NewPoll(cross(cur), "Q?", "a, b", 59, 60) })
	uassert.AbortsContains(t, cur, "1 minute to 7 days", func() { NewPoll(cross(cur), "Q?", "a, b", 60, 604801) })
	id := NewPoll(cross(cur), "Q?", "yes, no", 60, 60)

	Vote(cross(cur), id, commitreveal.Hash("yes", salt))
	uassert.AbortsContains(t, cur, "already voted", func() { Vote(cross(cur), id, commitreveal.Hash("no", salt)) })
	uassert.AbortsContains(t, cur, "not in reveal window", func() { Open(cross(cur), id, "yes", salt) })
	uassert.AbortsContains(t, cur, "unknown poll", func() { Vote(cross(cur), 9, commitreveal.Hash("no", salt)) })

	nowOverride = 1070
	testing.SetRealm(testing.NewUserRealm(bob))
	uassert.AbortsContains(t, cur, "voting is closed", func() { Vote(cross(cur), id, commitreveal.Hash("no", salt)) })
	uassert.AbortsContains(t, cur, "did not vote", func() { Open(cross(cur), id, "no", salt) })
	testing.SetRealm(testing.NewUserRealm(alice))
	uassert.AbortsContains(t, cur, "unknown option", func() { Open(cross(cur), id, "maybe", salt) })
	uassert.AbortsContains(t, cur, "does not match", func() { Open(cross(cur), id, "no", salt) })
	Open(cross(cur), id, "yes", salt)
	uassert.AbortsContains(t, cur, "already opened", func() { Open(cross(cur), id, "yes", salt) })
}

// Review fixes: no ':' in options, valid UTF-8 only, salts of 16+ characters, direct wallet calls only.
func TestPollInputRules(cur realm, t *testing.T) {
	reset()
	testing.SetRealm(testing.NewUserRealm(alice))
	// with options "a" and "a:b", one hash could open as either; ':' is not allowed
	uassert.AbortsContains(t, cur, "without ':'", func() { NewPoll(cross(cur), "Q?", "a, a:b", 60, 60) })
	uassert.AbortsContains(t, cur, "printable", func() { NewPoll(cross(cur), "Q?", "a, b"+string([]byte{0xff}), 60, 60) })
	uassert.AbortsContains(t, cur, "question", func() { NewPoll(cross(cur), "bad "+string([]byte{0xff}), "a, b", 60, 60) })

	id := NewPoll(cross(cur), "Q?", "yes, no", 60, 60)
	Vote(cross(cur), id, commitreveal.Hash("yes", "short"))
	nowOverride = 1070
	uassert.AbortsContains(t, cur, "at least 16", func() { Open(cross(cur), id, "yes", "short") })

	testing.SetRealm(testing.NewCodeRealm("gno.land/r/demo/other"))
	uassert.AbortsContains(t, cur, "direct user call", func() { NewPoll(cross(cur), "Q?", "a, b", 60, 60) })
	uassert.AbortsContains(t, cur, "direct user call", func() { Vote(cross(cur), id, commitreveal.Hash("no", salt)) })
}

// Render escapes poll text and shows 10 polls per page, newest first.
func TestRenderEscapesAndPages(cur realm, t *testing.T) {
	reset()
	testing.SetRealm(testing.NewUserRealm(alice))
	NewPoll(cross(cur), "[click](https://evil.example) # now", "yes, no", 60, 60)
	out := Render("")
	uassert.True(t, strings.Contains(out, `\[click\]\(https`), out)
	uassert.False(t, strings.Contains(out, `[click](https`))

	for i := 0; i < 11; i++ {
		NewPoll(cross(cur), "Poll", "yes, no", 60, 60)
	}
	// 12 polls: page 1 shows 11..2, page 2 shows 1 and 0
	p1 := Render("")
	uassert.True(t, strings.Contains(p1, "## 11. Poll"))
	uassert.True(t, strings.Contains(p1, "## 2. Poll"))
	uassert.False(t, strings.Contains(p1, "## 1. Poll"))
	uassert.True(t, strings.Contains(p1, ":page/2)"))
	p2 := Render("page/2")
	uassert.True(t, strings.Contains(p2, "## 1. Poll"))
	uassert.True(t, strings.Contains(p2, "## 0. "))
	uassert.False(t, strings.Contains(p2, "Older polls"))
	uassert.True(t, strings.Contains(Render("page/9"), "No polls on this page"))
	uassert.True(t, strings.Contains(Render("page/x"), "Not found"))
}
