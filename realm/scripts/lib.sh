#!/bin/bash
# Shared helpers for the local gnodev chain (sourced). Needs the Gno toolchain: gno, gnokey, gnodev.
GNO_HOME="${GNO_HOME:-$HOME/.gno}"
export PATH="$GNO_HOME/bin:$PATH"
export GNOROOT="${GNOROOT:-$GNO_HOME/src}"
OWNER=g1vxsg6ht4nklaud70yaszcgkhc9ttancr9nlzzq
PKG="gno.land/r/$OWNER/taproom/v1"
LIB="gno.land/p/$OWNER/commitreveal/v0"
POLL="gno.land/r/$OWNER/sealedpoll/v0"
AVATAR="gno.land/p/$OWNER/avatar/v0"
RPC="${RPC:-127.0.0.1:26657}"
CHAIN="${CHAIN:-dev}"
qeval() { gnokey query vm/qeval -data "$PKG.$1" -remote "$RPC" 2>&1 | sed -n 's/^data: //p'; }
