# Double-tap: recipe

What the mod does, precisely enough to rebuild it.

## Shape

- `mods/doubletap/` is `mod.clone` of Herdr's shipped `tabs` mod (version 0.1.11), with
  its own asset paths (`mods/doubletap/win-*.svg`). `mod.json`: `place: "none"`, and an
  `overlay` (popup, 250 × 460) so `mod.open:doubletap` opens the choice popup; a layout
  puts it in its tab bar block (`window_drag: true`, 42 px).
- `upstream/tabs.main.js`: the shipped tab bar it was cloned from. `test/upstream.test.js`
  compares it with the installed `mods/tabs/main.js` (skipped where Herdr isn't installed).
- `tap.js`: plain logic (no UI), imported by the tests.
- `settings.js`: the choice popup. The same mod draws it: `main.js` checks
  `props().view === "settings"` or `props().overlay` in `init` and hands over to `Settings`.
- `scripts/install.sh`: copies the mod into `~/.config/herdr-app/mods/doubletap`. With
  `--layout`, also `layout.clone {name: "main", as: "doubletap"}` (once), rewrites its
  `content.mod: "tabs"` to `"doubletap"` with `scripts/layout.mjs`, and switches to it.

## The choice

Stored with `setShared("doubletap.action", value)`:

| value | double-click does |
| --- | --- |
| absent or unreadable | `tab.new {space}` |
| `{kind: "terminal"}` | `tab.new {space}` |
| `{kind: "menu"}` | `openOverlay({...NEW_MENU, at})`, `NEW_MENU` = `{mod: "new-menu", kind: "popup", width: 250, height: 512}` (the **+** button opens the same), `at` = the click's window position |
| `{kind: "agent", key, name, run, machine}` | `tab.new {name, space, argv: run}` |

`space` is the active space. An agent is stored with its `run` copied from
`knownAgents({on: machine})` and the machine of the space shown when it was picked
(`null` = this computer), so a double-click there needs no lookup. In a space on another
machine, `knownAgents({on: space.machine})` is asked for the same `key`: installed, it
starts with that machine's `run`; otherwise `notify({title: "<name> isn't installed on
<machine | this computer>", level: "warning"})` and nothing starts.

## Clicks on the empty bar

The empty bar is the `tab-scroll` row behind the tabs. Tabs and buttons stop their own
presses, so only presses on the empty part reach it.

- Press with `click_count == 2`: cancel a waiting popup, `stop_propagation()` (so the
  `window_drag` block doesn't maximize the window), then do the choice.
- Press with `click_count > 2`: `stop_propagation()`, nothing else (a triple-click starts
  one thing).
- Press with `click_count == 1`: remember where, unless it is the press that activated
  the window (`window().active` false, or it turned true less than 300 ms ago; the bar
  notes when in `render`).
- Release within 4 px of a remembered press: wait the system's double-click interval
  (`defaults read -g com.apple.mouse.doubleClick` in seconds, 500 ms when unset, clamped
  to 200–2000 ms, plus 30 ms; read once at start with `exec`), then open the popup at the
  release point: `openOverlay({mod: "doubletap", kind: "popup", width: 250, height: 460,
  at, props: {view: "settings"}})`. A window drag never delivers its release here, so it
  opens nothing.
- A press on a tab or any bar button (+, Files, Changes, a tab's ×, window buttons)
  forgets the remembered press and cancels a waiting popup, so a stale press from an
  earlier window drag or a quick click onto a tab never opens it.

## The popup

`popover` background, 5 px padding, 12.8 px text, height `min(460, 150 + max(1, n) * 31)`
for `n` installed agents on the shown space's machine; the popup frame follows the
content's height, and 460 is its upper bound (the list scrolls beyond it). Title "Double-click opens" (12 px, semibold). Rows 31 px, 9 px
side padding, 7 px radius; the current choice has a `selected` background and an
`accent` ✓; `hover` on hover:

1. Terminal (`icons/shell.svg`), hint `T`
2. Menu, choose each time (`+`), hint `M`
3. heading "An agent" (11 px, `dim`), then each installed agent with its icon, hints
   `1`–`9`; "Checking installed agents…" while loading, "Could not load agents" or
   "No agents installed" otherwise.

A click or its key stores the choice and closes the popup; Esc closes it unchanged.
