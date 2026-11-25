#!/bin/bash
# Play as another regular on the LOCAL chain with a premined throwaway key (p2..p10).
# Usage: local-bot.sh join <key> <round> <pick> | reveal <key> <round> <pick> | settle <key> <round>
SD="$(cd "$(dirname "$0")" && pwd)"
source "$SD/lib.sh"
[ "$RPC" = "127.0.0.1:26657" ] || { echo "refusing: local chain only"; exit 1; }
act=$1 key=$2 round=$3 pick=$4
salt="bot-$key-$round"
call() { local fn=$1 send=$2; shift 2; local a=(); for x in "$@"; do a+=(-args "$x"); done; [ -n "$send" ] && a+=(-send "$send")
  echo "" | gnokey maketx call -pkgpath "$PKG" -func "$fn" "${a[@]}" -gas-fee 50000ugnot -gas-wanted 50000000 \
    -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin "$key" 2>&1 | grep -E "OK!|GAS USED|panic|Error" | head -2; }
case "$act" in
  join) call Join 1000000ugnot "$round" "$(printf '%s' "$pick:$salt" | sha256sum | cut -d' ' -f1)" ;;
  reveal) call Reveal "" "$round" "$pick" "$salt" ;;
  settle) call Settle "" "$round" ;;
  *) echo "usage: local-bot.sh join|reveal|settle <key> <round> [pick]"; exit 1 ;;
esac
