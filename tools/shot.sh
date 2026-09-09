#!/bin/sh
# Screenshot at real size: tools/shot.sh <query> [w] [h] [out.png]   e.g. tools/shot.sh "ch=2&silent&nosave" 1280 720
cd "$(dirname "$0")/.." || exit 1
Q=${1:-}; W=${2:-1280}; H=${3:-720}; OUT=${4:-artifacts/shot-$(echo "$Q" | tr -c 'a-zA-Z0-9' '_')-${W}x${H}.png}
CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --window-size=$W,$H --virtual-time-budget=4000 --screenshot="$OUT" "file://$PWD/index.html?$Q" >/dev/null 2>&1
echo "$OUT"
