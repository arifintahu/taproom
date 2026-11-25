#!/bin/bash
# Send test GNOT on the LOCAL chain from the premined throwaway key p1 to an address (the app's dev key).
# Usage: local-fund.sh <g1address> [ugnot]   (default 100 GNOT)
SD="$(cd "$(dirname "$0")" && pwd)"
source "$SD/lib.sh"
[ "$RPC" = "127.0.0.1:26657" ] || { echo "refusing: local chain only"; exit 1; }
TO="$1"; AMT="${2:-100000000}"
[[ "$TO" =~ ^g1[0-9a-z]{38}$ ]] || { echo "usage: local-fund.sh <g1address> [ugnot]"; exit 1; }
echo "" | gnokey maketx send -to "$TO" -send "${AMT}ugnot" -gas-fee 1000000ugnot -gas-wanted 2000000 \
  -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin p1 2>&1 | grep -E "OK!|HEIGHT|Error|error" | head -3
gnokey query "bank/balances/$TO" -remote "$RPC" 2>/dev/null | sed -n 's/^data: /balance: /p'
