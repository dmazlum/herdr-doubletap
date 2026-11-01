#!/bin/sh
# Copies the doubletap mod into the Herdr app's home, which reloads it within a
# second. Copies, not symlinks: Herdr doesn't reload a symlinked mod folder when
# its files change.
#
#   npm run sync               only the mod (while developing)
#   npm run install-layout     the mod, plus a `doubletap` layout: Herdr's main
#                              layout with this tab bar, switched to at once
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
home=${HERDR_APP_HOME:-"$HOME/.config/herdr-app"}
[ -d "$home" ] || { echo "no Herdr app home at $home" >&2; exit 1; }
[ -L "$home/mods/doubletap" ] && rm "$home/mods/doubletap"
mkdir -p "$home/mods/doubletap"
rsync -a --delete --exclude gpui-kit.d.ts --exclude jsconfig.json "$here/mods/doubletap/" "$home/mods/doubletap/"
echo "synced the mod into $home/mods/doubletap"
[ "${1:-}" = "--layout" ] || exit 0

layout="$home/layouts/doubletap.json"
if [ ! -f "$layout" ]; then
  herdr-app do layout.clone '{"name":"main","as":"doubletap"}' >/dev/null
fi
node "$here/scripts/layout.mjs" "$layout"
herdr-app do layout.switch '{"name":"doubletap"}' >/dev/null
echo "switched to the doubletap layout (back: herdr-app do layout.switch '{\"name\":\"main\"}')"
