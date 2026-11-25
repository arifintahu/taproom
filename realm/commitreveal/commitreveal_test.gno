package commitreveal

import (
	"testing"

	"gno.land/p/nt/testutils/v0"
	"gno.land/p/nt/uassert/v0"
)

var (
	alice = testutils.TestAddress("alice")
	bob   = testutils.TestAddress("bob")
	carol = testutils.TestAddress("carol")
)

func TestHashAndVerify(t *testing.T) {
	// sha256("22:salt") as lowercase hex
	uassert.Equal(t, "c0a6aa2df5143eceefa9c8810f6de57954348568784460fd91084bb43ac738e6", Hash("22", "salt"))
	uassert.True(t, Verify(Hash("yes", "s1"), "yes", "s1"))
	uassert.False(t, Verify(Hash("yes", "s1"), "no", "s1"))
	uassert.False(t, Verify(Hash("yes", "s1"), "yes", "s2"))
}

func TestNewRejectsEmptyWindows(cur realm, t *testing.T) {
	uassert.PanicsContains(t, cur, "windows must be positive", func() { New(100, 0, 10) })
	uassert.PanicsContains(t, cur, "windows must be positive", func() { New(100, 10, -1) })
	s := New(100, 60, 30)
	uassert.Equal(t, int64(160), s.CommitEnd)
	uassert.Equal(t, int64(190), s.RevealEnd)
}

func TestPhases(t *testing.T) {
	s := New(100, 60, 30)
	uassert.True(t, s.Phase(100) == CommitPhase)
	uassert.True(t, s.Phase(159) == CommitPhase)
	uassert.True(t, s.Phase(160) == RevealPhase)
	uassert.True(t, s.Phase(189) == RevealPhase)
	uassert.True(t, s.Phase(190) == ClosedPhase)
}

func TestFullLifecycle(t *testing.T) {
	s := New(0, 60, 60)
	uassert.NoError(t, s.Commit(10, alice, Hash("33", "a")))
	uassert.NoError(t, s.Commit(20, bob, Hash("50", "b")))
	uassert.NoError(t, s.Commit(30, carol, Hash("22", "c")))
	uassert.Equal(t, 3, s.Count())
	uassert.True(t, s.Has(bob))

	uassert.NoError(t, s.Reveal(70, carol, "22", "c"))
	uassert.NoError(t, s.Reveal(80, alice, "33", "a"))

	// Revealed keeps commit order, not reveal order.
	opened := s.Revealed()
	uassert.Equal(t, 2, len(opened))
	uassert.Equal(t, alice, opened[0].Who)
	uassert.Equal(t, "33", opened[0].Value)
	uassert.Equal(t, carol, opened[1].Who)

	missing := s.Unrevealed()
	uassert.Equal(t, 1, len(missing))
	uassert.Equal(t, bob, missing[0])

	v, ok := s.Value(carol)
	uassert.True(t, ok)
	uassert.Equal(t, "22", v)
	_, ok = s.Value(bob)
	uassert.False(t, ok)

	players := s.Players()
	uassert.Equal(t, 3, len(players))
	uassert.Equal(t, alice, players[0])
	// Players returns a copy: changing it does not change the session.
	players[0] = bob
	uassert.Equal(t, alice, s.Players()[0])
}

func TestCommitRules(t *testing.T) {
	s := New(0, 60, 60)
	uassert.ErrorContains(t, s.Commit(10, alice, "abc"), "64 hex chars")
	uassert.ErrorContains(t, s.Commit(10, alice, "zz"+Hash("1", "x")[2:]), "64 hex chars")
	uassert.NoError(t, s.Commit(10, alice, Hash("1", "x")))
	uassert.ErrorContains(t, s.Commit(11, alice, Hash("2", "x")), "already committed")
	uassert.ErrorContains(t, s.Commit(60, bob, Hash("1", "y")), "commit window closed")
}

func TestRevealRules(t *testing.T) {
	s := New(0, 60, 60)
	uassert.NoError(t, s.Commit(10, alice, Hash("7", "salt")))
	uassert.ErrorContains(t, s.Reveal(59, alice, "7", "salt"), "not in reveal window")
	uassert.ErrorContains(t, s.Reveal(70, bob, "7", "salt"), "not a player")
	uassert.ErrorContains(t, s.Reveal(70, alice, "7", "wrong"), "does not match")
	uassert.ErrorContains(t, s.Reveal(70, alice, "8", "salt"), "does not match")
	uassert.NoError(t, s.Reveal(70, alice, "7", "salt"))
	uassert.ErrorContains(t, s.Reveal(71, alice, "7", "salt"), "already revealed")
	uassert.ErrorContains(t, s.Reveal(120, alice, "7", "salt"), "not in reveal window")
	uassert.True(t, s.IsRevealed(alice))
}
