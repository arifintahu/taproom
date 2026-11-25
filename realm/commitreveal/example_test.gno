package commitreveal

import (
	"testing"

	"gno.land/p/nt/uassert/v0"
)

// A sealed yes/no poll in a few lines: the session owns windows, commits and reveals;
// the caller only counts the opened values. This is the README example.
func TestExampleSealedPoll(t *testing.T) {
	poll := New(0, 3600, 3600) // one hour to vote, one hour to open

	// Voting: each voter sends only a hash; the salt stays on their device.
	_ = poll.Commit(10, alice, Hash("yes", "a-secret"))
	_ = poll.Commit(20, bob, Hash("no", "b-secret"))
	_ = poll.Commit(30, carol, Hash("yes", "c-secret"))

	// Opening: voters reveal their choice and salt; a wrong salt is refused.
	_ = poll.Reveal(3700, alice, "yes", "a-secret")
	_ = poll.Reveal(3800, carol, "yes", "c-secret")
	// bob never opens his vote

	yes, no := 0, 0
	for _, o := range poll.Revealed() {
		if o.Value == "yes" {
			yes++
		} else {
			no++
		}
	}
	uassert.Equal(t, 2, yes)
	uassert.Equal(t, 0, no)
	uassert.Equal(t, 1, len(poll.Unrevealed())) // bob's vote does not count
	uassert.True(t, poll.Phase(7200) == ClosedPhase)
}
