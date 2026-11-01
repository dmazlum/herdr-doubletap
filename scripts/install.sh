#!/bin/sh
# Installs the doubletap mod into the Herdr app's home, which reloads it within a
# second, and optionally puts its tab bar into a layout. Copies, not symlinks:
# Herdr doesn't reload a symlinked mod folder when its files change.
#
#   npm run sync                          only the mod (needed by every setup below)
#   npm run install-layout                Herdr's main layout, as a clone named `doubletap`
#   npm run install-layout -- <layout>    that layout: a personal one is changed in place
#                                         (a copy is kept as <layout>.json.before-doubletap);
#                                         a shipped one (main, terminals, win98) is cloned
#                                         first as <layout>-doubletap
#   npm run remove-layout -- <layout>     puts Herdr's tab bar back in that layout
#
# A layout whose tab bar is a mod of its own (not Herdr's `tabs`) can't be switched
# over; the script says so. Give that mod the gesture with `npm run vendor -- <mod>`.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
home=${HERDR_APP_HOME:-"$HOME/.config/herdr-app"}
[ -d "$home" ] || { echo "no Herdr app home at $home" >&2; exit 1; }
[ -L "$home/mods/doubletap" ] && rm "$home/mods/doubletap"
mkdir -p "$home/mods/doubletap"
rsync -a --delete --exclude gpui-kit.d.ts --exclude jsconfig.json "$here/mods/doubletap/" "$home/mods/doubletap/"
echo "synced the mod into $home/mods/doubletap"

mode=${1:-}
[ -n "$mode" ] || exit 0
name=${2:-main}
case "$name" in */*|*.json) echo "give a layout name, like main or my-layout" >&2; exit 2 ;; esac

if [ "$mode" = "--remove" ]; then
  node "$here/scripts/layout.mjs" "$home/layouts/$name.json" --remove
  exit 0
fi
[ "$mode" = "--layout" ] || { echo "unknown option $mode" >&2; exit 2; }
[ -f "$home/layouts/$name.json" ] || { echo "no layout $name in $home/layouts" >&2; exit 1; }

case "$name" in
  main|terminals|win98)
    # Shipped: Herdr restores its own copy if edited, so work on a clone.
    target=$([ "$name" = main ] && echo doubletap || echo "$name-doubletap")
    if [ ! -f "$home/layouts/$target.json" ]; then
      # Check before cloning, so a layout with its own tab bar leaves no clone behind.
      node "$here/scripts/layout.mjs" "$home/layouts/$name.json" --check || {
        code=$?
        [ "$code" = 3 ] && echo "the $name layout draws its own tab bar; see README, \"Your own tab bar\"" >&2
        exit "$code"
      }
      herdr-app do layout.clone "{\"name\":\"$name\",\"as\":\"$target\"}" >/dev/null
    fi ;;
  *)
    target=$name
    node "$here/scripts/layout.mjs" "$home/layouts/$name.json" --check || {
      code=$?
      [ "$code" = 3 ] && echo "the $name layout draws its own tab bar; see README, \"Your own tab bar\"" >&2
      exit "$code"
    }
    [ -f "$home/layouts/$name.json.before-doubletap" ] || cp "$home/layouts/$name.json" "$home/layouts/$name.json.before-doubletap" ;;
esac

node "$here/scripts/layout.mjs" "$home/layouts/$target.json" || {
  code=$?
  [ "$code" = 3 ] && echo "the $target layout draws its own tab bar; see README, \"Your own tab bar\"" >&2
  exit "$code"
}
herdr-app do layout.switch "{\"name\":\"$target\"}" >/dev/null
echo "switched to the $target layout"
