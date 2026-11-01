#!/bin/sh
# Copies the double-click logic (bar.js, tap.js) into another tab bar mod, for a
# layout whose tab bar isn't Herdr's `tabs`. Run it again to update the copies.
#
#   npm run vendor -- ~/.config/herdr-app/mods/my-tabs
#
# Then wire it up as README, "Your own tab bar", shows. The choice popup comes
# from the doubletap mod, so install that too (npm run sync).
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
dir=${1:-}
[ -n "$dir" ] && [ -f "$dir/main.js" ] || { echo "usage: npm run vendor -- <tab bar mod folder with a main.js>" >&2; exit 2; }
for f in bar.js tap.js; do
  if [ -f "$dir/$f" ] && ! head -1 "$dir/$f" | grep -q "Double-click\|Plain logic for the double-tap"; then
    echo "$dir/$f exists and isn't doubletap's; not overwriting it" >&2; exit 1
  fi
done
cp "$here/mods/doubletap/bar.js" "$here/mods/doubletap/tap.js" "$dir/"
echo "copied bar.js and tap.js into $dir"
