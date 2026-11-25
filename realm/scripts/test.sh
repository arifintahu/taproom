#!/bin/bash
# Runs the realm unit tests in WSL (Gno has no native Windows build).
export PATH="$HOME/.gno/bin:$PATH"
export GNOROOT="$HOME/.gno/src"
SRC="$(cd "$(dirname "$0")/.." && pwd)/taproom"
rm -rf "$HOME/taproom-realm"
mkdir -p "$HOME/taproom-realm"
cp -r "$SRC" "$HOME/taproom-realm/taproom"
cd "$HOME/taproom-realm/taproom"
gno test ${1:+-run "$1"} -v ./... 2>&1 | grep -E "^(=== RUN|--- |ok|FAIL|PASS|panic)|Error|expected|unexpected|undefined" | head -${2:-80}
