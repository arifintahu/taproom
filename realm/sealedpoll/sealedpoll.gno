// Package sealedpoll runs sealed polls: anyone opens a question with 2 to 8 options, voters
// seal a choice (only its hash goes on chain), then open it in the reveal window. The tally
// counts opened votes only, and the realm reports how many sealed votes were never opened.
//
// It is a second realm built on the commitreveal package: the session handles the windows,
// one vote per address, reveal checks and who never opened. This realm holds no coins.
package sealedpoll

import (
	"strconv"
	"strings"
	"time"

	"gno.land/p/g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq/commitreveal"
)

const (
	maxOptions     = 8
	maxQuestionLen = 140
	maxOptionLen   = 40
)

type Poll struct {
	ID       int
	Creator  address
	Question string
	Options  []string
	Seal     *commitreveal.Session
}

var polls []*Poll

// nowOverride lets tests control time; zero means use the block time.
var nowOverride int64

func now() int64 {
	if nowOverride != 0 {
		return nowOverride
	}
	return time.Now().Unix()
}

// NewPoll opens a poll. options is a comma-separated list of 2 to 8 distinct choices;
// commitSecs and revealSecs are the voting and opening windows in seconds.
func NewPoll(cur realm, question, options string, commitSecs, revealSecs int64) int {
	question = strings.TrimSpace(question)
	if question == "" || len(question) > maxQuestionLen || !printable(question) {
		panic("question must be 1 to 140 printable characters")
	}
	var opts []string
	for _, o := range strings.Split(options, ",") {
		o = strings.TrimSpace(o)
		if o == "" || len(o) > maxOptionLen || !printable(o) {
			panic("each option must be 1 to 40 printable characters")
		}
		for _, seen := range opts {
			if seen == o {
				panic("options must be different")
			}
		}
		opts = append(opts, o)
	}
	if len(opts) < 2 || len(opts) > maxOptions {
		panic("a poll needs 2 to 8 options")
	}
	p := &Poll{
		ID:       len(polls),
		Creator:  cur.Previous().Address(),
		Question: question,
		Options:  opts,
		Seal:     commitreveal.New(now(), commitSecs, revealSecs),
	}
	polls = append(polls, p)
	return p.ID
}

// Vote seals a choice: hash is commitreveal.Hash(option, salt), computed by the voter's client.
func Vote(cur realm, id int, hash string) {
	p := getPoll(id)
	if err := p.Seal.Commit(now(), cur.Previous().Address(), hash); err != nil {
		panic(voteError(err))
	}
}

// Open reveals a sealed vote with its option and salt during the opening window.
func Open(cur realm, id int, option, salt string) {
	p := getPoll(id)
	if !p.hasOption(option) {
		panic("unknown option")
	}
	if err := p.Seal.Reveal(now(), cur.Previous().Address(), option, salt); err != nil {
		panic(voteError(err))
	}
}

// PollCount is the number of polls.
func PollCount() int { return len(polls) }

// Tally returns a poll's state as JSON: phase (vote, open or closed), sealed votes, opened votes,
// counts per option in option order, and votes sealed but never opened.
func Tally(id int) string {
	p := getPoll(id)
	counts := p.counts()
	opened := p.Seal.Revealed()
	var sb strings.Builder
	sb.WriteString(`{"id":` + strconv.Itoa(p.ID) + `,"question":` + strconv.Quote(p.Question))
	sb.WriteString(`,"phase":"` + phaseName(p.Seal.Phase(now())) + `","votes":` + strconv.Itoa(p.Seal.Count()))
	sb.WriteString(`,"opened":` + strconv.Itoa(len(opened)) + `,"counts":{`)
	for i, o := range p.Options {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(strconv.Quote(o) + ":" + strconv.Itoa(counts[i]))
	}
	sb.WriteString(`},"unopened":` + strconv.Itoa(p.Seal.Count()-len(opened)) + "}")
	return sb.String()
}

// Render lists every poll with its phase; counts appear once votes start opening.
func Render(path string) string {
	var sb strings.Builder
	sb.WriteString("# Sealed polls\n\nVotes stay sealed until their owners open them. Built on commitreveal.\n\n")
	if len(polls) == 0 {
		sb.WriteString("No polls yet.\n")
		return sb.String()
	}
	t := now()
	for i := len(polls) - 1; i >= 0; i-- {
		p := polls[i]
		phase := p.Seal.Phase(t)
		opened := len(p.Seal.Revealed())
		sb.WriteString("## " + strconv.Itoa(p.ID) + ". " + p.Question + "\n\n")
		switch phase {
		case commitreveal.CommitPhase:
			sb.WriteString("Voting is open: " + strconv.Itoa(p.Seal.Count()) + " sealed votes. Options: " + strings.Join(p.Options, ", ") + ".\n\n")
			continue
		case commitreveal.RevealPhase:
			sb.WriteString("Opening votes: " + strconv.Itoa(opened) + " of " + strconv.Itoa(p.Seal.Count()) + " opened so far.\n\n")
		default:
			sb.WriteString("Closed: " + strconv.Itoa(p.Seal.Count()) + " sealed votes, " + strconv.Itoa(opened) + " opened.\n\n")
		}
		for j, c := range p.counts() {
			sb.WriteString("- " + p.Options[j] + ": " + strconv.Itoa(c) + "\n")
		}
		if phase == commitreveal.ClosedPhase {
			if n := p.Seal.Count() - opened; n > 0 {
				noun := "votes"
				if n == 1 {
					noun = "vote"
				}
				sb.WriteString("\n" + strconv.Itoa(n) + " sealed " + noun + " never opened.\n")
			}
		}
		sb.WriteString("\n")
	}
	return sb.String()
}

func getPoll(id int) *Poll {
	if id < 0 || id >= len(polls) {
		panic("unknown poll")
	}
	return polls[id]
}

func (p *Poll) hasOption(o string) bool {
	for _, x := range p.Options {
		if x == o {
			return true
		}
	}
	return false
}

// counts returns opened votes per option, in option order.
func (p *Poll) counts() []int {
	counts := make([]int, len(p.Options))
	for _, o := range p.Seal.Revealed() {
		for i, x := range p.Options {
			if x == o.Value {
				counts[i]++
			}
		}
	}
	return counts
}

// voteError words the session's errors for voters.
func voteError(err error) string {
	switch err {
	case commitreveal.ErrCommitClosed:
		return "voting is closed"
	case commitreveal.ErrAlreadyCommitted:
		return "already voted"
	case commitreveal.ErrNotCommitted:
		return "you did not vote in this poll"
	case commitreveal.ErrAlreadyRevealed:
		return "already opened"
	}
	return err.Error()
}

func phaseName(ph commitreveal.Phase) string {
	switch ph {
	case commitreveal.CommitPhase:
		return "vote"
	case commitreveal.RevealPhase:
		return "open"
	}
	return "closed"
}

func printable(s string) bool {
	for _, r := range s {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	return true
}
