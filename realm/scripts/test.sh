#!/bin/bash
# Runs the realm unit tests. Needs the Gno toolchain (gno on PATH or in $GNO_HOME/bin).
GNO_HOME="${GNO_HOME:-$HOME/.gno}"
export PATH="$GNO_HOME/bin:$PATH"
export GNOROOT="${GNOROOT:-$GNO_HOME/src}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/taproom"
rm -rf "$HOME/taproom-realm"
mkdir -p "$HOME/taproom-realm"
cp -r "$SRC" "$HOME/taproom-realm/taproom"
cd "$HOME/taproom-realm/taproom"
gno test ${1:+-run "$1"} -v ./... 2>&1 | grep -E "^(=== RUN|--- |ok|FAIL|PASS|panic)|Error|expected|unexpected|undefined" | head -${2:-80}
