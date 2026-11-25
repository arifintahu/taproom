#!/bin/bash
# Shared helpers for the local gnodev chain (sourced). Run everything inside WSL.
export PATH="$HOME/.gno/bin:$PATH"
export GNOROOT="$HOME/.gno/src"
OWNER=g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq
PKG="gno.land/r/$OWNER/taproom"
RPC="${RPC:-127.0.0.1:26657}"
CHAIN="${CHAIN:-dev}"
qeval() { gnokey query vm/qeval -data "$PKG.$1" -remote "$RPC" 2>&1 | sed -n 's/^data: //p'; }
