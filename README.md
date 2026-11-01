# Double-tap

Herdr's tab bar, plus one gesture: **double-click the empty space beside your tabs** to
start something new. By default a terminal opens in a new tab. Click that space once
and you choose what a double-click does from then on:

- **Terminal**: a new tab with your shell.
- **Menu, choose each time**: the same menu the **+** button opens, right where you
  double-clicked.
- **An agent**: one of your installed agents (Claude Code, Codex, …) starts in a new tab.

The choice is kept in Herdr's shared state (`doubletap.action`), so it survives restarts.
You can also open the choice from a key: bind `mod.open:doubletap` in `keys.json`.

Everything else is Herdr's tab bar as of tabs 0.1.11. A mod can't add to another mod, so
this is a copy (`mod.clone`), and Herdr's updates to its own tab bar don't reach it by
themselves: `npm test` fails when the installed Herdr ships a different tab bar, see
[upstream/](upstream/README.md). The Files/Changes panel each space remembers is kept per
tab bar, so this layout and Herdr's main layout remember it separately.

## Install

```sh
git clone https://github.com/dmazlum/herdr-doubletap.git
cd herdr-doubletap
npm run install-layout
```

This copies the mod to `~/.config/herdr-app/mods/doubletap`, makes a `doubletap` layout
(a clone of Herdr's main layout, via `layout.clone`) whose tab bar is this mod, and
switches to it. To go back: `herdr-app do layout.switch '{"name":"main"}'`, or pick a
layout in Settings.

Already using your own layout? Point its tab bar block at the mod instead:
`"content": { "mod": "doubletap" }` in place of `"tabs"`.

## How it tells clicks apart

- The empty bar is also where you drag the window. A double-click there would normally
  maximize the window; Double-tap takes the second press first, so it opens your choice
  instead. Dragging the window still works.
- A single click waits as long as your system's double-click interval (macOS: System
  Settings → Mouse/Trackpad, 500 ms by default) for a second one before opening the choice
  popup, so a double-click never shows the popup first.
- A triple-click starts one thing, not two.
- A press that moves more than 4 px before release is a drag, not a click.
- The click that brings the Herdr window to the front opens nothing.
- An agent remembers the machine it was picked on. Double-click in a space on another
  machine and it starts as that machine knows it; if it isn't installed there, you get a
  warning instead of a tab that fails.
- Clicks on tabs, **+**, Files, Changes and the window buttons behave as before.

In the choice popup, `T` picks Terminal, `M` the menu, and `1`–`9` an agent.

## Develop

```sh
npm run sync     # copy the mod into Herdr; it reloads within a second
npm test         # logic tests under Node, with herdr/gpui stubbed
herdr-app check ~/.config/herdr-app/mods/doubletap
```

Copy, don't symlink: Herdr doesn't reload a symlinked mod folder when its files change.
See [RECIPE.md](RECIPE.md) for the full behavior.

## License

MIT
