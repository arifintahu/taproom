#!/bin/bash
# Play as another regular on the LOCAL chain with a premined throwaway key (p2..p10).
# Usage: local-bot.sh new <key> <commitSecs> <revealSecs> | join <key> <round> <pick> | reveal <key> <round> <pick> | settle <key> <round>
SD="$(cd "$(dirname "$0")" && pwd)"
source "$SD/lib.sh"
[ "$RPC" = "127.0.0.1:26657" ] || { echo "refusing: local chain only"; exit 1; }
act=$1 key=$2 round=$3 pick=$4
salt="bot-$key-$round"
call() { local fn=$1 send=$2; shift 2; local a=(); for x in "$@"; do a+=(-args "$x"); done; [ -n "$send" ] && a+=(-send "$send")
  echo "" | gnokey maketx call -pkgpath "$PKG" -func "$fn" "${a[@]}" -gas-fee 100000ugnot -gas-wanted 100000000 \
    -chainid "$CHAIN" -remote "$RPC" -broadcast -insecure-password-stdin "$key" 2>&1 | grep -E "OK!|GAS USED|panic|Error" | head -2; }
case "$act" in
  new) call NewRound "" "$3" "$4" 0 ;;
  join) # commit = sha256("<round>:<address>:<pick>:<salt>")
    addr=$(gnokey list | awk -v k="$key" '$2 == k { for (i = 1; i < NF; i++) if ($i == "addr:") print $(i + 1) }')
    call Join 1000000ugnot "$round" "$(printf '%s' "$round:$addr:$pick:$salt" | sha256sum | cut -d' ' -f1)" ;;
  reveal) call Reveal "" "$round" "$pick" "$salt" ;;
  settle) call Settle "" "$round" ;;
  *) echo "usage: local-bot.sh new|join|reveal|settle <key> ..."; exit 1 ;;
esac
