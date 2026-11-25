#!/bin/bash
# Start a fresh local gnodev chain and deploy the Taproom realm from this repo with the owner key
# (the deployer becomes the fee recipient). gnodev premines every key in the WSL keybase.
# Keeps running until stopped, so start it in the background:
#   MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-22.04 -- bash /mnt/d/code/projects/gno/taproom/realm/scripts/local-start.sh
SD="$(cd "$(dirname "$0")" && pwd)"
source "$SD/lib.sh"
pkill -x gnodev; sleep 2
WORK="$HOME/taproom-local"
rm -rf "$WORK" && mkdir -p "$WORK/empty"
cp -r "$SD/../taproom" "$WORK/taproom"
cd "$WORK/empty"
gnodev local -no-web -no-watch -empty-blocks -deploy-key "$OWNER" > /tmp/taproom-gnodev.log 2>&1 &
NODE=$!
for i in $(seq 1 60); do
  gnokey query vm/qrender -data "gno.land/r/sys/cla:" -remote "$RPC" 2>&1 | grep -q "^data:" && break
  sleep 2
done
echo "chain up; deploying $PKG"
# about 63M gas and 3.9 GNOT storage deposit for the current package (2026-11-25)
echo "" | gnokey maketx addpkg -pkgdir "$WORK/taproom" -pkgpath "$PKG" -gas-fee 1000000ugnot -gas-wanted 80000000 \
  -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin mywallet 2>&1 | grep -E "OK!|GAS USED|STORAGE|Error|error" | head -5
echo "RoundCount() = $(qeval 'RoundCount()')"
# Stay attached: WSL stops gnodev when this script's wsl.exe session ends. Run it in the background.
echo "local chain ready on http://127.0.0.1:26657 (Ctrl+C or local-stop.sh to stop)"
wait $NODE
