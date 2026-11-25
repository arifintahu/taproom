#!/bin/bash
# Print raw qeval output for each view, to pin the client's parser to real data.
SD="$(cd "$(dirname "$0")" && pwd)"
source "$SD/lib.sh"
for e in "RoundCount()" "RoundsJSON(0, 10)" "PlayerJSON(\"$OWNER\")" "FeeRecipient()" "FeesAccrued()" "Claimable(\"$OWNER\")"; do
  echo "== $e"; gnokey query vm/qeval -data "$PKG.$e" -remote "$RPC" 2>&1 | head -4
done
if [ "$1" = "seed" ]; then
  echo "== seeding: p2 opens a Quick table and joins with pick 22"
  call() { local key=$1 fn=$2 send=$3; shift 3; local a=(); for x in "$@"; do a+=(-args "$x"); done; [ -n "$send" ] && a+=(-send "$send")
    echo "" | gnokey maketx call -pkgpath "$PKG" -func "$fn" "${a[@]}" -gas-fee 1000000ugnot -gas-wanted 50000000 -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin "$key" 2>&1 | grep -E "OK!|GAS USED|Error|panic" | head -3; }
  call p2 NewRound "" 120 120 0
  call p2 Join 1000000ugnot 0 "$(printf '%s' '22:probe' | sha256sum | cut -d' ' -f1)"
  echo "== RoundsJSON after seeding"; gnokey query vm/qeval -data "$PKG.RoundsJSON(0, 10)" -remote "$RPC" 2>&1 | head -3
fi
