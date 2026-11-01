# Double-tap

Herdr's tab bar, plus one gesture: **double-click the empty space beside your tabs** to
start something new. By default a terminal opens in a new tab. Click that space once
and you choose what a double-click does from then on:

- **Terminal**: a new tab with your shell.
- **Menu, choose each time**: the same menu the **+** button opens, right where you
  double-clicked.
- **An agent**: one of your installed agents (Claude Code, Codex, …) starts in a new tab.

The choice is kept in Herdr's shared state (`doubletap.action`), so it survives restarts.
Everything else is Herdr's own tab bar, unchanged.

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
- A single click waits 320 ms for a second one before opening the choice popup, so a
  double-click never flashes the popup first.
- A press that moves more than 4 px before release is a drag, not a click.
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
