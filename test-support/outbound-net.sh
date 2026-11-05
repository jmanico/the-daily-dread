#!/usr/bin/env bash
set -euo pipefail
# Called by CI via sudo unshare --net. No external interfaces/routes are created.
# The exact selected Node binary is supplied by the reviewed workflow.
if [ "$#" -ne 1 ] || [ ! -x "$1" ]; then exit 1; fi
ip link set lo up
ip address add 11.0.0.1/32 dev lo
exec "$1" --test integration/outbound-sockets.mjs
