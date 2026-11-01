import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";

register("./stubs/hooks.mjs", import.meta.url);
// Herdr gives every mod copy a localStorage; Node 20 has none (and 22's warns without a file).
const memory = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => { memory.set(k, String(v)); },
} });
const { KEY, DEFAULT_WAIT, SLOP, NEW_MENU, TERMINAL, choice, agentChoice, picked, launch, resolveAgent, waitFrom, Taps } = await import("../mods/doubletap/tap.js");
const { store, state } = await import("./stubs/herdr.mjs");
const { default: DoubleTap } = await import("../mods/doubletap/main.js");
const { useDoubletap, useTabs, mods, setPreview } = await import("../scripts/layout.mjs");
const { EmptyBar, POPUP } = await import("../mods/doubletap/bar.js");
const { MAX_HEIGHT } = await import("../mods/doubletap/settings.js");
const { div, h_flex } = await import("./stubs/gpui.mjs");

const press = (count, x = 500, y = 20) => ({ click_count: count, position: { x, y } });

// A stand-in for a handler's cx: records propagation stops and pending timers.
function fakeCx() {
  const cx = { stopped: 0, timers: [], tasks: [] };
  cx.spawn = (fn) => { cx.tasks.push(fn({ notify() {} })); };
  cx.stop_propagation = () => { cx.stopped++; };
  cx.timer = {
    after(ms, fn) {
      const t = { ms, fn, cancelled: false, cancel() { t.cancelled = true; } };
      cx.timers.push(t);
      return t;
    },
  };
  return cx;
}

const claude = { key: "claude", name: "Claude Code", run: ["claude"], installed: true };

beforeEach(() => {
  store.clear();
  Object.assign(state, { runs: [], overlays: [], closed: [], notes: [], props: {}, agents: [], active: true });
  state.spaces = [{ id: "sp1", machine: null, active: true, tabs: [] }];
});

test("nothing stored, or junk stored, means a terminal", () => {
  for (const v of [undefined, null, "menu", 3, {}, { kind: "nope" }, { kind: "agent" }, { kind: "agent", key: "x", run: [] }, { kind: "agent", key: "x", run: [1] }]) {
    assert.deepEqual(choice(v), TERMINAL, JSON.stringify(v));
  }
});

test("a stored agent keeps its key, name and command", () => {
  const a = agentChoice(claude);
  assert.deepEqual(a, { kind: "agent", key: "claude", name: "Claude Code", run: ["claude"], machine: null });
  assert.equal(agentChoice(claude, "vps").machine, "vps");
  assert.deepEqual(choice(a), a);
  assert.equal(choice({ kind: "agent", key: "x", run: ["x"] }).name, "x", "a missing name falls back to the key");
  a.run.push("--oops");
  assert.deepEqual(claude.run, ["claude"], "the stored command is a copy");
});

test("picked follows the stored choice", () => {
  assert.ok(picked(undefined, "terminal"));
  assert.ok(picked({ kind: "menu" }, "menu"));
  assert.ok(!picked({ kind: "menu" }, "terminal"));
  assert.ok(picked(agentChoice(claude), "claude"));
  assert.ok(!picked(agentChoice(claude), "agent"));
});

test("launch: terminal, the + menu where clicked, or the agent", () => {
  const at = { x: 400, y: 21 }, here = { id: "sp1", machine: null };
  assert.deepEqual(launch(undefined, here, at), { run: ["tab.new", { space: "sp1" }] });
  assert.deepEqual(launch({ kind: "menu" }, here, at), { overlay: { mod: "new-menu", kind: "popup", width: 250, height: 512, at } });
  assert.deepEqual(launch(agentChoice(claude), here, at), { run: ["tab.new", { name: "Claude Code", space: "sp1", argv: ["claude"] }] });
  assert.deepEqual(NEW_MENU, { mod: "new-menu", kind: "popup", width: 250, height: 512 }, "the + button's menu");
});

test("an agent picked on another machine is looked up on this space's machine", () => {
  const remote = { id: "sp2", machine: "vps" };
  const c = choice(agentChoice(claude));
  assert.deepEqual(launch(agentChoice(claude), remote, null), { lookup: c });
  assert.deepEqual(resolveAgent(c, remote, [{ ...claude, run: ["/opt/claude"] }]), { run: ["tab.new", { name: "Claude Code", space: "sp2", argv: ["/opt/claude"] }] });
  assert.deepEqual(resolveAgent(c, remote, [{ ...claude, installed: false }]), { missing: "Claude Code isn't installed on vps" });
  assert.deepEqual(resolveAgent(c, { id: "sp1", machine: null }, []), { missing: "Claude Code isn't installed on this computer" });
});

test("the wait follows the system's double-click interval", () => {
  assert.equal(waitFrom("0.5\n"), 530);
  assert.equal(waitFrom("1.2"), 1230);
  assert.equal(waitFrom(""), DEFAULT_WAIT + 30, "unset: macOS's default");
  assert.equal(waitFrom("junk"), DEFAULT_WAIT + 30);
  assert.equal(waitFrom("0.05"), 230, "never shorter than 200 ms");
  assert.equal(waitFrom("9"), 2030, "never longer than 2 s");
});

test("Taps: one still click is single, a second press is double, a drag is nothing", () => {
  const t = new Taps();
  assert.equal(t.down(press(1)), null);
  assert.equal(t.up(press(1)), "single");
  assert.equal(t.down(press(2)), "double");
  assert.equal(t.up(press(2)), null, "the double's release isn't another click");

  t.down(press(1, 100));
  assert.equal(t.up(press(1, 100 + SLOP + 1)), null, "moved: a drag");
  t.down(press(1, 100));
  assert.equal(t.up(press(1, 100 + SLOP)), "single", "within slop");

  assert.equal(t.up(press(1)), null, "a release without our press (a tab's) is ignored");

  t.down(press(1)); t.up(press(1));
  assert.equal(t.down(press(2)), "double");
  assert.equal(t.down(press(3)), null, "a triple-click starts only one thing");
  assert.equal(t.up(press(3)), null);
  assert.equal(t.down(press(4)), null);

  t.down(press(1), true);
  assert.equal(t.up(press(1)), null, "the click that activated the window opens nothing");
  t.down(press(1));
  t.forget();
  assert.equal(t.up(press(1)), null);
});

async function bar() {
  const v = new DoubleTap();
  const cx = fakeCx();
  v.init({}, cx);
  await Promise.all(cx.tasks);
  v.bar.activatedAt = 0; // as if the window had been active for a while
  return v;
}

test("double-click on the empty bar opens a terminal by default and keeps the window from maximizing", async () => {
  const v = await bar();
  const cx = fakeCx();
  v.bar.down(press(1), cx);
  v.bar.up(press(1), cx);
  assert.equal(cx.timers.length, 1, "the first click waits");
  assert.equal(cx.timers[0].ms, DEFAULT_WAIT + 30, "the system's interval (unset here: 500 ms)");
  v.bar.down(press(2), cx);
  assert.equal(cx.timers[0].cancelled, true, "the second press cancels the settings popup");
  assert.equal(cx.stopped, 1);
  assert.deepEqual(state.runs, [["tab.new", { space: "sp1" }]]);
  assert.deepEqual(state.overlays, []);
});

test("double-click with Menu opens the + menu where clicked", async () => {
  store.set(KEY, { kind: "menu" });
  const v = await bar();
  v.bar.down(press(2, 640, 18), fakeCx());
  assert.deepEqual(state.runs, []);
  assert.deepEqual(state.overlays, [{ mod: "new-menu", kind: "popup", width: 250, height: 512, at: { x: 640, y: 18 } }]);
});

test("double-click with an agent starts it in a new tab", async () => {
  store.set(KEY, agentChoice(claude));
  (await bar()).bar.down(press(2), fakeCx());
  assert.deepEqual(state.runs, [["tab.new", { name: "Claude Code", space: "sp1", argv: ["claude"] }]]);
});

test("a lone click opens the settings popup where it was clicked, after the wait", async () => {
  const v = await bar();
  const cx = fakeCx();
  v.bar.down(press(1, 700, 22), cx);
  v.bar.up(press(1, 700, 22), cx);
  assert.deepEqual(state.overlays, []);
  cx.timers[0].fn(fakeCx());
  assert.equal(state.overlays.length, 1);
  const o = state.overlays[0];
  assert.equal(o.mod, "doubletap");
  assert.equal(o.kind, "popup");
  assert.deepEqual(o.at, { x: 700, y: 22 });
  assert.deepEqual(o.props, { view: "settings" });
  assert.equal(o.height, 460, "an upper bound: the popup is as tall as its rows");
  assert.deepEqual(state.runs, []);
});

test("the settings popup stores the pick and closes", async () => {
  state.props = { view: "settings", overlay: "ov9" };
  state.agents = [claude, { key: "codex", name: "Codex", run: ["codex"], installed: false }];
  const v = new DoubleTap();
  const cx = fakeCx();
  let spawned;
  cx.focus_handle = () => ({ focus() {} });
  cx.spawn = (fn) => { spawned = fn({ notify() {} }); };
  v.init(state.props, cx);
  await spawned;
  assert.deepEqual(v.settings.agents.map((a) => a.key), ["claude"], "only installed agents are offered");
  assert.ok(v.render(cx), "renders");

  v.settings.pick({ kind: "menu" });
  assert.deepEqual(store.get(KEY), { kind: "menu" });
  assert.deepEqual(state.closed, ["ov9"]);
});

test("the layout script swaps only the tab bar", () => {
  const layout = {
    type: "row",
    children: [
      { id: "sidebar", content: { mod: "spaces" } },
      { type: "column", children: [{ id: "tabs", window_drag: true, content: { mod: "tabs" } }, { content: { tab: {} } }] },
    ],
    floating: [{ content: { mod: "tabs-extra" } }],
  };
  assert.equal(useDoubletap(layout), 1);
  assert.equal(layout.children[1].children[0].content.mod, "doubletap");
  assert.equal(layout.children[1].children[0].window_drag, true);
  assert.equal(layout.children[0].content.mod, "spaces");
  assert.equal(useDoubletap(layout), 0, "running it again changes nothing");
  assert.deepEqual(mods(layout), ["spaces", "doubletap", "tabs-extra"]);
  assert.equal(useTabs(layout), 1, "and back");
  assert.equal(layout.children[1].children[0].content.mod, "tabs");
});

test("mods lists pane headers too, and survives odd nodes", () => {
  assert.deepEqual(mods({ children: [null, { content: { pane: { header: { content: { mod: "my-header" } } } } }] }), ["my-header"]);
  assert.equal(useDoubletap(null), 0);
});

test("the choice popup opens as tall as the popup allows", () => {
  assert.equal(POPUP.height, MAX_HEIGHT);
  assert.equal(POPUP.mod, "doubletap");
});

test("bar.js and tap.js can be copied into another mod: they import only herdr and each other", () => {
  for (const f of ["bar.js", "tap.js"]) {
    const src = readFileSync(new URL(`../mods/doubletap/${f}`, import.meta.url), "utf8");
    const from = [...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
    for (const m of from) assert.ok(["herdr", "./tap.js"].includes(m), `${f} imports ${m}`);
  }
});

// The README's "Your own tab bar" example, as another person's mod would write it.
class MyTabs {
  init(_props, cx) { this.dt = new EmptyBar(cx); }
  render() {
    this.dt.track();
    const tab = div().id("tab").on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.dt.cancel(); });
    return h_flex().child(h_flex().id("empty").flex_1()
      .on_mouse_down("left", (e, cx) => this.dt.down(e, cx))
      .on_mouse_up("left", (e, cx) => this.dt.up(e, cx))
      .child(tab));
  }
}

test("the README's own-tab-bar example works with the copied files", async () => {
  const v = new MyTabs();
  const cx = fakeCx();
  v.init({}, cx);
  await Promise.all(cx.tasks);
  const root = v.render();
  const empty = root.calls.find((c) => c[0] === "child")[1];
  const handler = (el, name) => el.calls.find((c) => c[0] === name && c[1] === "left")[2];
  v.dt.activatedAt = 0;
  const hx = fakeCx();
  handler(empty, "on_mouse_down")(press(1), hx);
  handler(empty, "on_mouse_up")(press(1), hx);
  hx.timers[0].fn(fakeCx());
  assert.deepEqual(state.overlays.map((o) => [o.mod, o.props]), [["doubletap", { view: "settings" }]], "a click opens doubletap's popup");
  handler(empty, "on_mouse_down")(press(2), hx);
  assert.deepEqual(state.runs, [["tab.new", { space: "sp1" }]], "a double-click starts the choice");
});

test("no other product is named anywhere in the repo", () => {
  const root = new URL("../", import.meta.url);
  const walk = (dir) => readdirSync(dir).flatMap((n) => {
    if ([".git", "node_modules"].includes(n)) return [];
    const p = new URL(n, dir);
    return statSync(p).isDirectory() ? walk(new URL(`${n}/`, dir)) : [p];
  });
  const banned = ["para" + "dev", "super" + "set"];
  for (const f of walk(root)) {
    const text = readFileSync(f, "utf8").toLowerCase();
    for (const b of banned) assert.ok(!text.includes(b), `${f.pathname} mentions ${b}`);
  }
});

test("a triple-click on the empty bar starts one terminal", async () => {
  const v = await bar();
  const cx = fakeCx();
  v.bar.down(press(1), cx); v.bar.up(press(1), cx);
  v.bar.down(press(2), cx); v.bar.up(press(2), cx);
  v.bar.down(press(3), cx); v.bar.up(press(3), cx);
  assert.equal(state.runs.length, 1);
  assert.equal(cx.stopped, 2, "neither the second nor the third press maximizes the window");
});

test("pressing a tab cancels a waiting click and forgets its press", async () => {
  const v = await bar();
  const cx = fakeCx();
  v.bar.down(press(1), cx); v.bar.up(press(1), cx);
  v.bar.cancel(); // what a tab's or button's press does
  assert.equal(cx.timers[0].cancelled, true);

  v.bar.down(press(1, 300), cx); // then a window drag: no release arrives
  v.bar.cancel();
  v.bar.up(press(1, 300), cx); // a later tab click's release bubbling up
  assert.equal(cx.timers.length, 1, "no popup from the stale press");
});

test("the click that activates the window opens no popup", async () => {
  const v = await bar();
  const cx = fakeCx();
  state.active = false;
  v.bar.down(press(1), cx); v.bar.up(press(1), cx);
  state.active = true;
  v.bar.activatedAt = Date.now();
  v.bar.down(press(1), cx); v.bar.up(press(1), cx);
  assert.equal(cx.timers.length, 0);
  v.bar.activatedAt = Date.now() - 1000;
  v.bar.down(press(1), cx); v.bar.up(press(1), cx);
  assert.equal(cx.timers.length, 1, "later clicks work again");
});

test("an agent picked elsewhere and missing here gives a warning, not a broken tab", async () => {
  store.set(KEY, agentChoice(claude, "vps"));
  const v = await bar();
  const cx = fakeCx();
  state.agents = [];
  v.bar.down(press(2), cx);
  await Promise.all(cx.tasks);
  assert.deepEqual(state.runs, []);
  assert.equal(state.notes[0].title, "Claude Code isn't installed on this computer");

  state.agents = [claude];
  v.bar.down(press(2), cx);
  await Promise.all(cx.tasks);
  assert.deepEqual(state.runs, [["tab.new", { name: "Claude Code", space: "sp1", argv: ["claude"] }]]);
});

test("setPreview gives a layout a settings picture, keeping one it has", () => {
  const bare = { id: "root" };
  assert.equal(setPreview(bare, "layouts/doubletap.svg"), true);
  assert.equal(bare.preview, "layouts/doubletap.svg");
  const own = { id: "root", preview: "layouts/mine.png" };
  assert.equal(setPreview(own, "layouts/doubletap.svg"), false);
  assert.equal(own.preview, "layouts/mine.png");
});

test("the layout preview is an SVG the settings screen can show", () => {
  const svg = readFileSync(new URL("../art/layout-preview.svg", import.meta.url), "utf8");
  assert.match(svg, /^<svg [^>]*viewBox="0 0 320 200"/);
});
