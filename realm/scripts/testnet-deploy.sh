#!/bin/bash
# Deploy the four packages to a public testnet, in dependency order: commitreveal and avatar
# (imported by the realms), then the taproom realm and sealedpoll.
#
# Usage: testnet-deploy.sh <gnokey key name> [simulate|broadcast]
#   simulate  (default) dry-runs every addpkg for free and prints the gas each one would use
#   broadcast sends the transactions
# Env: RPC (default https://rpc.onyx.testnets.gno.land:443), CHAIN (default onyx-1).
#
# On a chain with the "inert" code-submission policy (Onyx), addpkg parks a package until the
# network's package approver enables it; the storage deposit is taken at enable time, up to the
# max_deposit set here. Look a package up at https://gpas.onyx.testnets.gno.land/?path=<path>.
# A realm is reviewed only once the packages it imports are enabled.
set -e
SD="$(cd "$(dirname "$0")" && pwd)"
# set before lib.sh, whose defaults point at a local chain
RPC="${RPC:-https://rpc.onyx.testnets.gno.land:443}"
CHAIN="${CHAIN:-onyx-1}"
source "$SD/lib.sh"
KEY="$1"
MODE="${2:-simulate}"
[ -n "$KEY" ] || { echo "usage: testnet-deploy.sh <key> [simulate|broadcast]"; exit 1; }
case "$MODE" in simulate) SIM=(-simulate only) ;; broadcast) SIM=() ;; *) echo "mode must be simulate or broadcast"; exit 1 ;; esac

# refuse to run unless the node at RPC is the chain we mean to deploy to
NODE_CHAIN="$(curl -s "${RPC%/}/status" | sed -n 's/.*"network": *"\([^"]*\)".*/\1/p')"
[ "$NODE_CHAIN" = "$CHAIN" ] || { echo "refusing: $RPC reports chain '$NODE_CHAIN', expected '$CHAIN'"; exit 1; }
echo "deploying to $CHAIN at $RPC as $KEY ($MODE)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -r "$SD/../commitreveal" "$SD/../avatar" "$SD/../taproom" "$SD/../sealedpoll" "$WORK/"
# test files are not deployed
find "$WORK" -name '*_test.gno' -delete

deploy() { # <dir> <package path> <gas wanted> <max deposit in ugnot>
  echo "== $2 ($MODE)"
  echo "" | gnokey maketx addpkg -pkgdir "$WORK/$1" -pkgpath "$2" \
    -gas-wanted "$3" -gas-fee "$(( $3 / 1000 ))ugnot" -max-deposit "$4ugnot" \
    -chainid "$CHAIN" -remote "$RPC" "${SIM[@]}" -broadcast -insecure-password-stdin "$KEY" 2>&1 |
    grep -vE "^[[:space:]]+[0-9]+ +/|^Enter password|^$|EVENTS|^INFO" | head -"${LINES_SHOWN:-12}"
}

# gas and deposit caps: about 1.5x what each package used on a local chain
deploy commitreveal "$LIB" 30000000 3000000
deploy avatar "$AVATAR" 70000000 10000000
deploy taproom "$PKG" 160000000 15000000
deploy sealedpoll "$POLL" 40000000 3000000
