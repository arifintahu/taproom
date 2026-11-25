package sealedpoll

import (
	"strings"
	"testing"

	"gno.land/p/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/commitreveal"
	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

var (
	alice = testutils.TestAddress("poll-alice")
	bob   = testutils.TestAddress("poll-bob")
	carol = testutils.TestAddress("poll-carol")
)

func reset() {
	polls = nil
	nowOverride = 1000
}

func TestPollLifecycle(cur realm, t *testing.T) {
	reset()
	testing.SetRealm(testing.NewUserRealm(alice))
	id := NewPoll(cross(cur), "Ale or cider?", "ale, cider", 60, 60)
	uassert.Equal(t, 0, id)
	uassert.Equal(t, 1, PollCount())

	// Voting: each voter seals a choice; only the hash goes on chain.
	Vote(cross(cur), id, commitreveal.Hash("ale", "a-salt"))
	testing.SetRealm(testing.NewUserRealm(bob))
	Vote(cross(cur), id, commitreveal.Hash("cider", "b-salt"))
	testing.SetRealm(testing.NewUserRealm(carol))
	Vote(cross(cur), id, commitreveal.Hash("ale", "c-salt"))
	uassert.True(t, strings.Contains(Tally(id), `"phase":"vote","votes":3,"opened":0,`))

	// Opening: alice and bob open their votes; carol never does.
	nowOverride = 1070
	testing.SetRealm(testing.NewUserRealm(alice))
	Open(cross(cur), id, "ale", "a-salt")
	testing.SetRealm(testing.NewUserRealm(bob))
	Open(cross(cur), id, "cider", "b-salt")

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
	uassert.AbortsContains(t, cur, "windows must be positive", func() { NewPoll(cross(cur), "Q?", "a, b", 0, 60) })
	id := NewPoll(cross(cur), "Q?", "yes, no", 60, 60)

	Vote(cross(cur), id, commitreveal.Hash("yes", "s"))
	uassert.AbortsContains(t, cur, "already voted", func() { Vote(cross(cur), id, commitreveal.Hash("no", "s")) })
	uassert.AbortsContains(t, cur, "not in reveal window", func() { Open(cross(cur), id, "yes", "s") })
	uassert.AbortsContains(t, cur, "unknown poll", func() { Vote(cross(cur), 9, commitreveal.Hash("no", "s")) })

	nowOverride = 1070
	testing.SetRealm(testing.NewUserRealm(bob))
	uassert.AbortsContains(t, cur, "voting is closed", func() { Vote(cross(cur), id, commitreveal.Hash("no", "s")) })
	uassert.AbortsContains(t, cur, "did not vote", func() { Open(cross(cur), id, "no", "s") })
	testing.SetRealm(testing.NewUserRealm(alice))
	uassert.AbortsContains(t, cur, "unknown option", func() { Open(cross(cur), id, "maybe", "s") })
	uassert.AbortsContains(t, cur, "does not match", func() { Open(cross(cur), id, "no", "s") })
	Open(cross(cur), id, "yes", "s")
	uassert.AbortsContains(t, cur, "already opened", func() { Open(cross(cur), id, "yes", "s") })
}
