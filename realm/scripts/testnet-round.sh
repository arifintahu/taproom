#!/bin/bash
# Play one seeded round on a public testnet with throwaway keys, and print every transaction as a
# markdown table row: open a table, four joins, three reveals (the fourth seat forfeits), settle,
# and a claim by each key with a balance. Picks 10, 50, 20 and 70: the average of the revealed
# picks is 26.67, the target 17.78, so the third key wins 3.98 GNOT (pot 4 GNOT, fee 0.02).
#
# Usage: testnet-round.sh <funder key> [key1 key2 key3 key4]   (default keys p2 p3 p4 p5)
# Each key is topped up to 3 GNOT from the funder first. Salts are random per run and saved to
# ~/.taproom-salts/<chain>-<round>.txt before joining, so a seat can still be revealed by hand
# if the run is interrupted. On Onyx a run takes about 10 minutes (each transaction waits for a
# block); run it in its own terminal.
# Env: RPC (default https://rpc.onyx.testnets.gno.land:443), CHAIN (default onyx-1).
set -e
SD="$(cd "$(dirname "$0")" && pwd)"
# set before lib.sh, whose defaults point at a local chain
RPC="${RPC:-https://rpc.onyx.testnets.gno.land:443}"
CHAIN="${CHAIN:-onyx-1}"
source "$SD/lib.sh"
FUNDER="$1"; shift || true
if [ $# -eq 0 ]; then KEYS=(p2 p3 p4 p5); else KEYS=("$@"); fi
PICKS=(10 50 20 70)
[ -n "$FUNDER" ] && [ ${#KEYS[@]} -eq 4 ] || { echo "usage: testnet-round.sh <funder key> [four keys]"; exit 1; }
NODE_CHAIN="$(curl -s "${RPC%/}/status" | sed -n 's/.*"network": *"\([^"]*\)".*/\1/p')"
[ "$NODE_CHAIN" = "$CHAIN" ] || { echo "refusing: $RPC reports chain '$NODE_CHAIN', expected '$CHAIN'"; exit 1; }

addr() { gnokey list | awk -v k="$1" '$2 == k { for (i = 1; i < NF; i++) if ($i == "addr:") print $(i + 1) }'; }
balance() { gnokey query "bank/balances/$1" -remote "$RPC" 2>&1 | sed -n 's/^data: "\([0-9]*\)ugnot"/\1/p'; }
qv() { gnokey query vm/qeval -data "$PKG.$1" -remote "$RPC" 2>&1 | sed -n 's/^data: //p'; }
chain_time() { date -d "$(curl -s "${RPC%/}/status" | sed -n 's/.*"latest_block_time": *"\([^"]*\)".*/\1/p')" +%s; }

row() { # <step> <key> <output of gnokey>
  local hash height
  hash=$(echo "$3" | sed -n 's/^TX HASH: *//p'); height=$(echo "$3" | sed -n 's/^HEIGHT: *//p')
  if ! echo "$3" | grep -q '^OK!'; then echo "FAILED: $1 by $2"; echo "$3" | grep -E "Data:|Error|panic" | head -3; exit 1; fi
  echo "| $1 | $2 | $height | \`$hash\` |"
}
call() { # <key> <func> <gas wanted> <send or ""> [args...]
  local key=$1 fn=$2 gas=$3 send=$4; shift 4
  local a=(); for x in "$@"; do a+=(-args "$x"); done; [ -n "$send" ] && a+=(-send "$send")
  echo "" | gnokey maketx call -pkgpath "$PKG" -func "$fn" "${a[@]}" -gas-wanted "$gas" -gas-fee "$(( gas / 1000 ))ugnot" \
    -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin "$key" 2>&1
}

echo "playing on $CHAIN at $RPC with ${KEYS[*]} (funded by $FUNDER)"
echo "| Step | Key | Block | Transaction |"
echo "|---|---|---|---|"
for k in "${KEYS[@]}"; do
  a=$(addr "$k"); b=$(balance "$a"); b=${b:-0}
  if [ "$b" -lt 3000000 ]; then
    out=$(echo "" | gnokey maketx send -to "$a" -send "$(( 3000000 - b ))ugnot" -gas-wanted 2000000 -gas-fee 2000ugnot \
      -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin "$FUNDER" 2>&1)
    row "Fund $k with $(( (3000000 - b) / 1000 ))k ugnot" "$FUNDER" "$out"
  fi
done

out=$(call "${KEYS[0]}" NewRound 20000000 "" 180 180 0); row "Open a table (3 + 3 min)" "${KEYS[0]}" "$out"
ROUND=$(( $(qv 'RoundCount()' | sed -n 's/(\([0-9]*\) int)/\1/p') - 1 ))
SALTS=()
SALT_FILE="$HOME/.taproom-salts/$CHAIN-$ROUND.txt"
mkdir -p "$(dirname "$SALT_FILE")"
for i in 0 1 2 3; do
  k=${KEYS[$i]}; a=$(addr "$k"); s=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n'); SALTS[$i]=$s
  echo "$k round=$ROUND pick=${PICKS[$i]} salt=$s" >> "$SALT_FILE"   # before Join, so it is never lost
  h=$(printf '%s' "$ROUND:$a:${PICKS[$i]}:$s" | sha256sum | cut -d' ' -f1)
  out=$(call "$k" Join 30000000 1000000ugnot "$ROUND" "$h"); row "Join round $ROUND (sealed)" "$k" "$out"
done

RJ=$(qv "RoundJSON($ROUND)")
CEND=$(echo "$RJ" | grep -oE 'commitEnd\\":[0-9]+' | grep -oE '[0-9]+$'); REND=$(echo "$RJ" | grep -oE 'revealEnd\\":[0-9]+' | grep -oE '[0-9]+$')
while [ "$(chain_time)" -lt "$CEND" ]; do sleep 5; done
for i in 0 1 2; do
  out=$(call "${KEYS[$i]}" Reveal 30000000 "" "$ROUND" "${PICKS[$i]}" "${SALTS[$i]}"); row "Reveal ${PICKS[$i]}" "${KEYS[$i]}" "$out"
done
while [ "$(chain_time)" -lt "$REND" ]; do sleep 5; done
out=$(call "${KEYS[1]}" Settle 80000000 "" "$ROUND"); row "Settle round $ROUND (${KEYS[3]} forfeits)" "${KEYS[1]}" "$out"
for k in "${KEYS[@]}"; do
  c=$(qv "Claimable(\"$(addr "$k")\")" | sed -n 's/(\([0-9]*\) int64)/\1/p')
  if [ "${c:-0}" -gt 0 ]; then out=$(call "$k" Claim 20000000 ""); row "Claim $(( c / 1000 ))k ugnot" "$k" "$out"; fi
done
echo "salts: $SALT_FILE"
echo "round $ROUND done; check it with: node tools/verify/verify-round.mjs $ROUND --rpc $RPC"
