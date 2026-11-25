package avatar

import (
	"encoding/base64"
	"strings"
	"testing"

	"gno.land/p/nt/uassert/v0"
)

const (
	owner = address("g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq")
	p2    = address("g1f5hdkzzfu4kd5hse9nyvxra0al8sy8rnzht4xs")
	p4    = address("g13ue4pyg2kw73r4pyc42tqjrsj2kkev57el0mx5")
)

// Combo must match the web app's address hash, so a gnome looks the same in both places.
func TestComboMatchesWebApp(t *testing.T) {
	uassert.Equal(t, 7, Combo(owner))
	uassert.Equal(t, 1, Combo(p2))
	uassert.Equal(t, 2, Combo(p4))
}

func TestBaseGnome(t *testing.T) {
	svg := Render(owner, [4]int{})
	uassert.True(t, strings.HasPrefix(svg, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="96" height="96" shape-rendering="crispEdges">`))
	uassert.True(t, strings.HasSuffix(svg, "</svg>"))
	uassert.Equal(t, 3, strings.Count(svg, "<g>")) // body, head, cap
	// combo 7: skin #553424, grey beard #b9b4ab, cap #2b6f8f
	uassert.True(t, strings.Contains(svg, `stroke="#553424"`))
	uassert.True(t, strings.Contains(svg, `stroke="#b9b4ab"`))
	uassert.True(t, strings.Contains(svg, `stroke="#2b6f8f"`))
	// pixel runs are 1 px strokes, one path per colour: M x y.5 h w
	uassert.True(t, strings.Contains(svg, ".5h"))
}

func TestItemsLayerInOrder(t *testing.T) {
	// hat 107 (Pirate tricorn), outfit 201, held 312, companion 403
	svg := Render(owner, [4]int{107, 201, 312, 403})
	uassert.Equal(t, 6, strings.Count(svg, "<g>")) // companion, body, outfit, head, hat, held
	uassert.False(t, strings.Contains(svg, `stroke="#2b6f8f"`), "a hat replaces the cap")
	uassert.True(t, strings.Contains(svg, `stroke="#2a2420"`), "tricorn colour")

	// the companion is drawn first, before the body
	comp := layerSVG(items[403][0], items[403][1])
	body := layerSVG(bodyPal[7], bodyRuns)
	uassert.True(t, strings.Index(svg, comp) < strings.Index(svg, body))
}

func TestUnknownOrMisplacedItemsAreIgnored(t *testing.T) {
	base := Render(owner, [4]int{})
	uassert.Equal(t, base, Render(owner, [4]int{113, 999, -1, 0}))
	uassert.Equal(t, base, Render(owner, [4]int{201, 101, 0, 0}), "items only count in their own slot")
	uassert.True(t, ValidItem(101))
	uassert.True(t, ValidItem(412))
	uassert.False(t, ValidItem(113))
	uassert.False(t, ValidItem(500))
}

func TestDataURI(t *testing.T) {
	uri := DataURI(p2, [4]int{105, 0, 0, 0})
	uassert.True(t, strings.HasPrefix(uri, "data:image/svg+xml;base64,"))
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(uri, "data:image/svg+xml;base64,"))
	uassert.NoError(t, err)
	uassert.Equal(t, Render(p2, [4]int{105, 0, 0, 0}), string(raw))
}

// dec must decode every character of the run alphabet to its index.
func TestDecMatchesAlphabet(t *testing.T) {
	for i := 0; i < len(alphabet); i++ {
		uassert.True(t, dec(alphabet[i]) == i, alphabet[i:i+1])
	}
}
