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
const { KEY, WAIT, SLOP, TERMINAL, choice, agentChoice, picked, label, launch, Taps } = await import("../mods/doubletap/tap.js");
const { store, state } = await import("./stubs/herdr.mjs");
const { default: DoubleTap } = await import("../mods/doubletap/main.js");
const { useDoubletap } = await import("../scripts/layout.mjs");

const press = (count, x = 500, y = 20) => ({ click_count: count, position: { x, y } });

// A stand-in for a handler's cx: records propagation stops and pending timers.
function fakeCx() {
  const cx = { stopped: 0, timers: [] };
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
  Object.assign(state, { runs: [], overlays: [], closed: [], props: {} });
});

test("nothing stored, or junk stored, means a terminal", () => {
  for (const v of [undefined, null, "menu", 3, {}, { kind: "nope" }, { kind: "agent" }, { kind: "agent", key: "x", run: [] }, { kind: "agent", key: "x", run: [1] }]) {
    assert.deepEqual(choice(v), TERMINAL, JSON.stringify(v));
  }
});

test("a stored agent keeps its key, name and command", () => {
  const a = agentChoice(claude);
  assert.deepEqual(a, { kind: "agent", key: "claude", name: "Claude Code", run: ["claude"] });
  assert.deepEqual(choice(a), a);
  assert.equal(choice({ kind: "agent", key: "x", run: ["x"] }).name, "x", "a missing name falls back to the key");
  a.run.push("--oops");
  assert.deepEqual(claude.run, ["claude"], "the stored command is a copy");
});

test("picked and label follow the stored choice", () => {
  assert.ok(picked(undefined, "terminal"));
  assert.ok(picked({ kind: "menu" }, "menu"));
  assert.ok(!picked({ kind: "menu" }, "terminal"));
  assert.ok(picked(agentChoice(claude), "claude"));
  assert.ok(!picked(agentChoice(claude), "agent"));
  assert.equal(label(undefined), "Terminal");
  assert.equal(label({ kind: "menu" }), "Menu");
  assert.equal(label(agentChoice(claude)), "Claude Code");
});

test("launch: terminal, the + menu where clicked, or the agent", () => {
  const at = { x: 400, y: 21 };
  assert.deepEqual(launch(undefined, "sp1", at), { run: ["tab.new", { space: "sp1" }] });
  assert.deepEqual(launch({ kind: "menu" }, "sp1", at), { overlay: { mod: "new-menu", kind: "popup", width: 250, height: 512, at } });
  assert.deepEqual(launch(agentChoice(claude), "sp1", at), { run: ["tab.new", { name: "Claude Code", space: "sp1", argv: ["claude"] }] });
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
  t.down(press(1));
  t.forget();
  assert.equal(t.up(press(1)), null);
});

function bar() {
  const v = new DoubleTap();
  v.init({}, fakeCx());
  return v;
}

test("double-click on the empty bar opens a terminal by default and keeps the window from maximizing", () => {
  const v = bar();
  const cx = fakeCx();
  v.emptyDown(press(1), cx);
  v.emptyUp(press(1), cx);
  assert.equal(cx.timers.length, 1, "the first click waits");
  assert.equal(cx.timers[0].ms, WAIT);
  v.emptyDown(press(2), cx);
  assert.equal(cx.timers[0].cancelled, true, "the second press cancels the settings popup");
  assert.equal(cx.stopped, 1);
  assert.deepEqual(state.runs, [["tab.new", { space: "sp1" }]]);
  assert.deepEqual(state.overlays, []);
});

test("double-click with Menu opens the + menu where clicked", () => {
  store.set(KEY, { kind: "menu" });
  const v = bar();
  v.emptyDown(press(2, 640, 18), fakeCx());
  assert.deepEqual(state.runs, []);
  assert.deepEqual(state.overlays, [{ mod: "new-menu", kind: "popup", width: 250, height: 512, at: { x: 640, y: 18 } }]);
});

test("double-click with an agent starts it in a new tab", () => {
  store.set(KEY, agentChoice(claude));
  bar().emptyDown(press(2), fakeCx());
  assert.deepEqual(state.runs, [["tab.new", { name: "Claude Code", space: "sp1", argv: ["claude"] }]]);
});

test("a lone click opens the settings popup where it was clicked, after the wait", () => {
  const v = bar();
  const cx = fakeCx();
  v.emptyDown(press(1, 700, 22), cx);
  v.emptyUp(press(1, 700, 22), cx);
  assert.deepEqual(state.overlays, []);
  cx.timers[0].fn(fakeCx());
  assert.equal(state.overlays.length, 1);
  const o = state.overlays[0];
  assert.equal(o.mod, "doubletap");
  assert.equal(o.kind, "popup");
  assert.deepEqual(o.at, { x: 700, y: 22 });
  assert.deepEqual(o.props, { view: "settings" });
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
