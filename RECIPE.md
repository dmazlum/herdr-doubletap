# Double-tap: recipe

What the mod does, precisely enough to rebuild it.

## Shape

- `mods/doubletap/` is `mod.clone` of Herdr's shipped `tabs` mod (version 0.1.11), with
  its own asset paths (`mods/doubletap/win-*.svg`). `mod.json`: `place: "none"`; a layout
  puts it in its tab bar block (`window_drag: true`, 42 px).
- `tap.js`: plain logic (no UI), imported by the tests.
- `settings.js`: the choice popup. The same mod draws it: `main.js` checks
  `props().view === "settings"` in `init` and hands over to `Settings`.
- `scripts/install.sh`: copies the mod into `~/.config/herdr-app/mods/doubletap`. With
  `--layout`, also `layout.clone {name: "main", as: "doubletap"}` (once), rewrites its
  `content.mod: "tabs"` to `"doubletap"` with `scripts/layout.mjs`, and switches to it.

## The choice

Stored with `setShared("doubletap.action", value)`:

| value | double-click does |
| --- | --- |
| absent or unreadable | `tab.new {space}` |
| `{kind: "terminal"}` | `tab.new {space}` |
| `{kind: "menu"}` | `openOverlay({mod: "new-menu", kind: "popup", width: 250, height: 512, at})`, `at` = the click's window position |
| `{kind: "agent", key, name, run}` | `tab.new {name, space, argv: run}` |

`space` is the active space. An agent is stored with its `run` copied from
`knownAgents()`, so a double-click needs no lookup.

## Clicks on the empty bar

The empty bar is the `tab-scroll` row behind the tabs. Tabs and buttons stop their own
presses, so only presses on the empty part reach it.

- Press with `click_count >= 2`: cancel a waiting popup, `stop_propagation()` (so the
  `window_drag` block doesn't maximize the window), then do the choice.
- Press with `click_count == 1`: remember where.
- Release within 4 px of that press: wait 320 ms (`cx.timer.after`), then open the popup
  at the release point: `openOverlay({mod: "doubletap", kind: "popup", width: 250,
  height: 460, at, props: {view: "settings"}})`. A window drag never delivers its release
  here, so it opens nothing.
- A release whose press began on a tab (a tab drag) is ignored; the bar's own mouse-up
  forgets any press.

## The popup

`popover` background, 5 px padding, 12.8 px text, height `min(460, 150 + max(1, n) * 31)`
for `n` installed agents. Title "Double-click opens" (12 px, semibold). Rows 31 px, 9 px
side padding, 7 px radius; the current choice has a `selected` background and an
`accent` ✓; `hover` on hover:

1. Terminal (`icons/shell.svg`), hint `T`
2. Menu, choose each time (`+`), hint `M`
3. heading "An agent" (11 px, `dim`), then each installed agent with its icon, hints
   `1`–`9`; "Checking installed agents…" while loading, "Could not load agents" or
   "No agents installed" otherwise.

A click or its key stores the choice and closes the popup; Esc closes it unchanged.
