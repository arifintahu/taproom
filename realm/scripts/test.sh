#!/bin/bash
# Runs the Gno tests for every package in realm/ (a gnowork.toml workspace).
# Needs the Gno toolchain (gno on PATH or in $GNO_HOME/bin). Usage: test.sh [test-name-regex] [max-lines]
GNO_HOME="${GNO_HOME:-$HOME/.gno}"
export PATH="$GNO_HOME/bin:$PATH"
export GNOROOT="${GNOROOT:-$GNO_HOME/src}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$HOME/taproom-realm"
rm -rf "$WORK" && mkdir -p "$WORK"
cp "$SRC/gnowork.toml" "$WORK/"
for d in "$SRC"/*/; do [ -f "$d/gnomod.toml" ] && cp -r "$d" "$WORK/"; done
cd "$WORK"
gno test ${1:+-run "$1"} -v ./... 2>&1 | grep -E "^(=== RUN|--- |ok|FAIL|PASS|panic)|Error|expected|unexpected|undefined|cannot" | head -${2:-120}
